// Supabase Edge Function — sync-live
// Scheduled via pg_cron every 2 minutes during match hours.
// Env vars injected automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Must configure manually: API_FOOTBALL_KEY  (Dashboard → Settings → Edge Functions → Secrets)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const API_KEY      = Deno.env.get('API_FOOTBALL_KEY')!
const API_HEADERS  = { 'x-apisports-key': API_KEY }
const LIVE_STATUSES = ['1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P']
const FT_STATUSES   = ['FT', 'AET', 'PEN']
const SOON_MINUTES  = 30

// ── Pick evaluation ───────────────────────────────────────────────────────────

function evalPick(
  pick: any,
  fix: any,
  homeHist: any,
  awayHist: any,
): { result: 'WON' | 'LOST'; actual: number } | null {
  const threshold = pick.threshold ?? parseFloat(String(pick.line).replace(/.*de\s+/i, ''))
  if (isNaN(threshold)) return null

  const ftH = fix.home_score,      ftA = fix.away_score
  const htH = fix.ht_home_score,   htA = fix.ht_away_score
  const h2H = (ftH != null && htH != null) ? ftH - htH : null
  const h2A = (ftA != null && htA != null) ? ftA - htA : null

  let actual: number | null = null

  if (pick.statKey) {
    switch (pick.statKey) {
      case 'total_goals':    actual = (ftH != null && ftA != null) ? ftH + ftA : null; break
      case 'ht_total_goals': actual = (htH != null && htA != null) ? htH + htA : null; break
      case '2h_total_goals': actual = (h2H != null && h2A != null) ? h2H + h2A : null; break
      case 'home_score':     actual = ftH;  break
      case 'away_score':     actual = ftA;  break
      case 'ht_home_score':  actual = htH;  break
      case 'ht_away_score':  actual = htA;  break
      case '2h_home_score':  actual = h2H;  break
      case '2h_away_score':  actual = h2A;  break
      case 'total_corners':
        actual = (homeHist?.corners != null && awayHist?.corners != null)
          ? homeHist.corners + awayHist.corners : null; break
      case 'home_corners':   actual = homeHist?.corners   ?? null; break
      case 'away_corners':   actual = awayHist?.corners   ?? null; break
      case 'total_cards':
        actual = (homeHist?.yellow_cards != null && awayHist?.yellow_cards != null)
          ? homeHist.yellow_cards + awayHist.yellow_cards : null; break
      default: actual = null
    }
  } else {
    const { stat, period, teamTarget } = pick
    if (['GOLS', 'GOLS MARCADOS'].includes(stat)) {
      if (period === 'FT')
        actual = teamTarget === 'TOTAL' ? (ftH ?? 0) + (ftA ?? 0)
               : teamTarget === 'HOME'  ? ftH : ftA
      else if (period === 'HT')
        actual = teamTarget === 'TOTAL' ? (htH ?? 0) + (htA ?? 0)
               : teamTarget === 'HOME'  ? htH : htA
      else if (period === '2H')
        actual = teamTarget === 'TOTAL' ? (h2H ?? 0) + (h2A ?? 0)
               : teamTarget === 'HOME'  ? h2H : h2A
    } else if (stat === 'ESCANTEIOS') {
      actual = (teamTarget === 'AWAY' ? awayHist : homeHist)?.corners ?? null
    } else if (['CARTÃO AMARELO', 'CARTÕES'].includes(stat)) {
      actual = (teamTarget === 'AWAY' ? awayHist : homeHist)?.yellow_cards ?? null
    }
  }

  if (actual === null || actual === undefined) return null
  const won = pick.type === 'OVER' ? actual > threshold : actual < threshold
  return { result: won ? 'WON' : 'LOST', actual }
}

// ── Settle PENDING tickets ────────────────────────────────────────────────────

async function settleTickets() {
  const { data: pending } = await supabase
    .from('odd_tickets').select('*').eq('status', 'PENDING')
  if (!pending?.length) return

  for (const ticket of pending) {
    const entries    = ticket.ticket_data.entries as any[]
    const fixtureIds = entries.map(e => e.fixture_id)

    const { data: fixes } = await supabase
      .from('fixtures')
      .select('api_id, status, home_score, away_score, ht_home_score, ht_away_score')
      .in('api_id', fixtureIds)

    const fixMap: Record<number, any> = Object.fromEntries((fixes ?? []).map(f => [f.api_id, f]))
    if (!fixtureIds.every(id => FT_STATUSES.includes(fixMap[id]?.status))) continue

    const { data: histRows } = await supabase
      .from('teams_history')
      .select('fixture_id, is_home, corners, yellow_cards')
      .in('fixture_id', fixtureIds)

    const histMap: Record<string, any> = {}
    ;(histRows ?? []).forEach(h => { histMap[`${h.fixture_id}-${h.is_home ? 'HOME' : 'AWAY'}`] = h })

    let ticketWon = true, hasUnevaluated = false

    const updatedEntries = entries.map(entry => {
      const fix      = fixMap[entry.fixture_id]
      const homeHist = histMap[`${entry.fixture_id}-HOME`]
      const awayHist = histMap[`${entry.fixture_id}-AWAY`]
      let matchWon   = true

      const updatedPicks = entry.picks.map((pick: any) => {
        if (pick.result) return pick
        const ev = evalPick(pick, fix, homeHist, awayHist)
        if (!ev) { hasUnevaluated = true; return pick }
        if (ev.result === 'LOST') matchWon = false
        return { ...pick, result: ev.result, actualValue: ev.actual }
      })

      if (!matchWon) ticketWon = false
      const matchResult = updatedPicks.every((p: any) => p.result === 'WON') ? 'WON'
                        : updatedPicks.some((p: any)  => p.result === 'LOST') ? 'LOST' : null
      return { ...entry, picks: updatedPicks, result: matchResult }
    })

    if (hasUnevaluated) {
      console.log(`⏳ ${ticket.date} (${ticket.mode}): waiting for corner/card stats`)
      continue
    }

    const finalStatus = ticketWon ? 'WON' : 'LOST'
    await supabase.from('odd_tickets')
      .update({ status: finalStatus, ticket_data: { ...ticket.ticket_data, entries: updatedEntries } })
      .eq('date', ticket.date).eq('mode', ticket.mode)

    console.log(`🏆 ${ticket.date} (${ticket.mode}) → ${finalStatus}`)
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  try {
    // 1. Active leagues
    const { data: leagues } = await supabase
      .from('leagues').select('id, api_id').eq('is_active', true)

    if (!leagues?.length)
      return Response.json({ ok: true, msg: 'no active leagues' })

    const leagueDbIds    = leagues.map(l => l.id)
    const leagueApiParam = leagues.map(l => l.api_id).join('-')

    // 2. Smart gate — skip API call if nothing is live or starting soon
    const nowUtc  = new Date()
    const brtDate = new Date(nowUtc.getTime() - 3 * 3600_000).toISOString().split('T')[0]
    const soonIso = new Date(nowUtc.getTime() + SOON_MINUTES * 60_000).toISOString()

    const { data: relevant } = await supabase
      .from('fixtures')
      .select('api_id')
      .in('league_id', leagueDbIds)
      .gte('date', `${brtDate}T00:00:00`)
      .lte('date', `${brtDate}T23:59:59`)
      .or(`status.in.(${LIVE_STATUSES.join(',')}),and(status.eq.NS,date.lte.${soonIso})`)

    if (!relevant?.length) {
      await settleTickets()
      return Response.json({ ok: true, msg: 'no live games' })
    }

    // 3. One API call — all active leagues at once
    const res   = await fetch(`https://v3.football.api-sports.io/fixtures?live=${leagueApiParam}`, { headers: API_HEADERS })
    const json  = await res.json()
    const games: any[] = json.response ?? []

    if (!games.length) {
      await settleTickets()
      return Response.json({ ok: true, msg: 'api: no live games' })
    }

    // 4. Parallel fixture updates
    await Promise.all(games.map(g => {
      const ht = g.score?.halftime
      console.log(`⚽ ${g.teams.home.name} ${g.goals.home ?? 0}-${g.goals.away ?? 0} ${g.teams.away.name} [${g.fixture.status.short}]`)
      return supabase.from('fixtures').update({
        status:        g.fixture.status.short,
        home_score:    g.goals.home,
        away_score:    g.goals.away,
        ht_home_score: ht?.home ?? null,
        ht_away_score: ht?.away ?? null,
        score:         g.score,
      }).eq('api_id', g.fixture.id)
    }))

    // 5. Settle tickets with updated scores
    await settleTickets()

    return Response.json({ ok: true, updated: games.length })
  } catch (e: any) {
    console.error('sync-live:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
})
