import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); env[m[1].trim()] = v; }
  });
} catch (_) {}

const API_KEY      = env.VITE_API_FOOTBALL_KEY;
const supabase     = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_HEADERS  = { 'x-apisports-key': API_KEY };
const LIVE_STATUSES = ['1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P'];
const FT_STATUSES   = ['FT', 'AET', 'PEN'];
const SOON_MINUTES  = 30;

// ── Pick evaluation (mirrors Odd20.tsx getActualVal + evaluatePick) ───────────

function evalPick(pick, fix, homeHist, awayHist) {
  const threshold = pick.threshold ?? parseFloat(String(pick.line).replace(/.*de\s+/i, ''));
  if (isNaN(threshold)) return null;

  const ftH = fix.home_score, ftA = fix.away_score;
  const htH = fix.ht_home_score, htA = fix.ht_away_score;
  const h2H = (ftH != null && htH != null) ? ftH - htH : null;
  const h2A = (ftA != null && htA != null) ? ftA - htA : null;

  let actual = null;

  if (pick.statKey) {
    // ── New format (statKey) ──────────────────────────────────────────────────
    switch (pick.statKey) {
      case 'total_goals':    actual = (ftH != null && ftA != null) ? ftH + ftA : null; break;
      case 'ht_total_goals': actual = (htH != null && htA != null) ? htH + htA : null; break;
      case '2h_total_goals': actual = (h2H != null && h2A != null) ? h2H + h2A : null; break;
      case 'home_score':     actual = ftH; break;
      case 'away_score':     actual = ftA; break;
      case 'ht_home_score':  actual = htH; break;
      case 'ht_away_score':  actual = htA; break;
      case '2h_home_score':  actual = h2H; break;
      case '2h_away_score':  actual = h2A; break;
      // Corners/cards — need teams_history (populated later by syncMissingStats)
      case 'total_corners':
        actual = (homeHist?.corners != null && awayHist?.corners != null)
          ? homeHist.corners + awayHist.corners : null; break;
      case 'home_corners':   actual = homeHist?.corners ?? null; break;
      case 'away_corners':   actual = awayHist?.corners ?? null; break;
      case 'total_cards':
        actual = (homeHist?.yellow_cards != null && awayHist?.yellow_cards != null)
          ? homeHist.yellow_cards + awayHist.yellow_cards : null; break;
      default: actual = null;
    }
  } else {
    // ── Legacy format ─────────────────────────────────────────────────────────
    const stat = pick.stat;
    if (['GOLS', 'GOLS MARCADOS'].includes(stat)) {
      if (pick.period === 'FT') {
        actual = pick.teamTarget === 'TOTAL' ? (ftH ?? 0) + (ftA ?? 0)
               : pick.teamTarget === 'HOME'  ? ftH : ftA;
      } else if (pick.period === 'HT') {
        actual = pick.teamTarget === 'TOTAL' ? (htH ?? 0) + (htA ?? 0)
               : pick.teamTarget === 'HOME'  ? htH : htA;
      } else if (pick.period === '2H') {
        actual = pick.teamTarget === 'TOTAL' ? (h2H ?? 0) + (h2A ?? 0)
               : pick.teamTarget === 'HOME'  ? h2H : h2A;
      }
    } else if (stat === 'ESCANTEIOS') {
      const h = pick.teamTarget === 'AWAY' ? awayHist : homeHist;
      actual = h?.corners ?? null;
    } else if (['CARTÃO AMARELO', 'CARTÕES'].includes(stat)) {
      const h = pick.teamTarget === 'AWAY' ? awayHist : homeHist;
      actual = h?.yellow_cards ?? null;
    } else if (stat === 'CHUTES') {
      const h = pick.teamTarget === 'AWAY' ? awayHist : homeHist;
      actual = h?.shots_total ?? null;
    }
  }

  if (actual === null || actual === undefined) return null;
  const won = pick.type === 'OVER' ? actual > threshold : actual < threshold;
  return { result: won ? 'WON' : 'LOST', actual };
}

// ── Settle PENDING tickets whose fixtures are all FT ─────────────────────────

async function settleTickets() {
  const { data: pending } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('status', 'PENDING');

  if (!pending?.length) return;

  for (const ticket of pending) {
    const entries    = ticket.ticket_data.entries;
    const fixtureIds = entries.map(e => e.fixture_id);

    // Are all fixtures finished?
    const { data: fixes } = await supabase
      .from('fixtures')
      .select('api_id, status, home_score, away_score, ht_home_score, ht_away_score')
      .in('api_id', fixtureIds);

    const fixMap = Object.fromEntries((fixes || []).map(f => [f.api_id, f]));
    const allFT  = fixtureIds.every(id => FT_STATUSES.includes(fixMap[id]?.status));
    if (!allFT) continue;

    // Load teams_history (for corners/cards picks; may be empty for very recent FT games)
    const { data: histRows } = await supabase
      .from('teams_history')
      .select('fixture_id, is_home, corners, yellow_cards, shots_total, goals_for, goals_against')
      .in('fixture_id', fixtureIds);

    const histMap = {};
    (histRows || []).forEach(h => { histMap[`${h.fixture_id}-${h.is_home ? 'HOME' : 'AWAY'}`] = h; });

    // Evaluate each pick
    let ticketWon       = true;
    let hasUnevaluated  = false;

    const updatedEntries = entries.map(entry => {
      const fix      = fixMap[entry.fixture_id];
      const homeHist = histMap[`${entry.fixture_id}-HOME`];
      const awayHist = histMap[`${entry.fixture_id}-AWAY`];
      let   matchWon = true;

      const updatedPicks = entry.picks.map(pick => {
        if (pick.result) return pick;                      // already settled
        const ev = evalPick(pick, fix, homeHist, awayHist);
        if (!ev) { hasUnevaluated = true; return pick; }  // missing stats → wait
        if (ev.result === 'LOST') matchWon = false;
        return { ...pick, result: ev.result, actualValue: ev.actual };
      });

      if (!matchWon) ticketWon = false;
      const matchResult = updatedPicks.every(p => p.result === 'WON') ? 'WON'
                        : updatedPicks.some(p => p.result === 'LOST') ? 'LOST' : null;
      return { ...entry, picks: updatedPicks, result: matchResult };
    });

    if (hasUnevaluated) {
      // Corners/cards not in teams_history yet — syncMissingStats will complete this
      console.log(`  ⏳ ${ticket.date} (${ticket.mode}): aguardando stats (escanteios/cartões)`);
      continue;
    }

    const finalStatus = ticketWon ? 'WON' : 'LOST';
    await supabase
      .from('odd_tickets')
      .update({ status: finalStatus, ticket_data: { ...ticket.ticket_data, entries: updatedEntries } })
      .eq('date', ticket.date)
      .eq('mode', ticket.mode);

    console.log(`  🏆 ${ticket.date} (${ticket.mode}) → ${finalStatus === 'WON' ? '💚 GREEN' : '❤️ RED'}`);
  }
}

const FINAL_STATUSES = ['FT', 'AET', 'PEN', 'CANC', 'PST', 'ABD'];

// ── Stale game sweep ──────────────────────────────────────────────────────────
// Fixes games stuck in a non-final status from the past 3 days.
// Runs one API call per affected date (max 3 calls total).

async function sweepStaleGames(leagueDbIds, leagueApiSet) {
  const nowUtc   = new Date();
  const staleFrom = new Date(nowUtc.getTime() - 3 * 24 * 3600 * 1000).toISOString();
  const staleTo   = new Date(nowUtc.getTime() - 2 * 3600 * 1000).toISOString(); // >2h ago

  const { data: stale } = await supabase
    .from('fixtures')
    .select('api_id, date')
    .in('league_id', leagueDbIds)
    .gte('date', staleFrom)
    .lte('date', staleTo)
    .not('status', 'in', `(${FINAL_STATUSES.join(',')})`);

  if (!stale?.length) return;

  const dates = [...new Set(stale.map(f => f.date.slice(0, 10)))];
  console.log(`🔧 Stale sweep: ${stale.length} fixture(s) across ${dates.join(', ')}`);

  for (const date of dates) {
    const res  = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&timezone=America/Sao_Paulo`, { headers: API_HEADERS });
    const json = await res.json();
    const games = (json.response || []).filter(g =>
      leagueApiSet.has(g.league.id) && FINAL_STATUSES.includes(g.fixture.status.short)
    );

    await Promise.all(games.map(g => {
      const ht = g.score?.halftime;
      console.log(`  ✓ [${g.fixture.status.short}] ${g.teams.home.name} ${g.goals.home}-${g.goals.away} ${g.teams.away.name}`);
      return supabase.from('fixtures').update({
        status:        g.fixture.status.short,
        home_score:    g.goals.home,
        away_score:    g.goals.away,
        ht_home_score: ht?.home ?? null,
        ht_away_score: ht?.away ?? null,
      }).eq('api_id', g.fixture.id)
        .not('status', 'in', `(${FINAL_STATUSES.join(',')})`);
    }));

    await new Promise(r => setTimeout(r, 1200));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function syncLive() {
  // 1. Load active leagues
  const { data: leagues } = await supabase
    .from('leagues').select('id, api_id').eq('is_active', true);
  if (!leagues?.length) { console.log('No active leagues.'); return; }

  const leagueDbIds    = leagues.map(l => l.id);
  const leagueApiParam = leagues.map(l => l.api_id).join('-');
  const leagueApiSet   = new Set(leagues.map(l => l.api_id));

  // 2. Stale sweep — fix games from past 3 days stuck in non-final status
  await sweepStaleGames(leagueDbIds, leagueApiSet);

  // 3. Smart gate — only call live endpoint if a game is live or starting soon
  const nowUtc  = new Date();
  const brtDate = new Date(nowUtc - 3 * 3600 * 1000).toISOString().split('T')[0];
  const soonIso = new Date(nowUtc.getTime() + SOON_MINUTES * 60 * 1000).toISOString();

  const { data: relevant } = await supabase
    .from('fixtures')
    .select('api_id')
    .in('league_id', leagueDbIds)
    .gte('date', `${brtDate}T00:00:00`)
    .lte('date', `${brtDate}T23:59:59`)
    .or(`status.in.(${LIVE_STATUSES.join(',')}),and(status.eq.NS,date.lte.${soonIso})`);

  if (!relevant?.length) {
    await settleTickets();
    console.log('✓ No live games today.');
    return;
  }

  console.log(`📡 ${relevant.length} fixture(s) active/soon — calling live API...`);

  // 4. One API call covers all active leagues
  const res   = await fetch(`https://v3.football.api-sports.io/fixtures?live=${leagueApiParam}`, { headers: API_HEADERS });
  const json  = await res.json();
  const games = json.response || [];

  if (!games.length) {
    console.log('No live games returned by API.');
    await settleTickets();
    return;
  }

  // 5. Parallel fixture updates
  await Promise.all(games.map(g => {
    const ht = g.score?.halftime;
    console.log(`⚽ ${g.teams.home.name} ${g.goals.home ?? 0}-${g.goals.away ?? 0} ${g.teams.away.name} [${g.fixture.status.short}]`);
    return supabase.from('fixtures').update({
      status:        g.fixture.status.short,
      home_score:    g.goals.home,
      away_score:    g.goals.away,
      ht_home_score: ht?.home  ?? null,
      ht_away_score: ht?.away  ?? null,
      score:         g.score,
    }).eq('api_id', g.fixture.id);
  }));

  // 6. Settle tickets after scores are up-to-date
  await settleTickets();

  console.log('✓ Sync complete.');
}

syncLive().catch(console.error);
