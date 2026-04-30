/**
 * Resolve bilhetes PENDING:
 *   Suporta picks antigos (teams_history / fixture_stats) e novos (statKey → odds reais)
 *   Uso: node scratch/resolveOddTickets.js [YYYY-MM-DD]
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function fetchApi(url) {
  for (let i = 3; i > 0; i--) {
    try {
      const r = await fetch(url, { headers: API_HEADERS });
      const d = await r.json();
      if (d.errors && Object.keys(d.errors).length > 0) throw new Error(JSON.stringify(d.errors));
      return d.response || [];
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Extração de valor real por statKey ──────────────────────────────────────

/**
 * Retorna o valor real de um pick dado o contexto disponível.
 * statKey (novo): define exatamente o que medir.
 * Fallback (legado): usa teams_history, fixture_stats ou API.
 */
function getActualValue({ pick, fxRow, fsHome, fsAway, histHome, histAway, apiStatsArr, homeTeamApiId, awayTeamApiId }) {
  const threshold = pick.threshold ?? parseFloat(String(pick.line).replace(/.*de\s+/i, ''));

  // ── Novo formato: statKey ────────────────────────────────────────────────
  if (pick.statKey) {
    const fx = fxRow;
    const ftHome  = fx?.home_score    ?? null;
    const ftAway  = fx?.away_score    ?? null;
    const htHome  = fx?.ht_home_score ?? null;
    const htAway  = fx?.ht_away_score ?? null;
    const h2Home  = (ftHome != null && htHome != null) ? ftHome - htHome : null;
    const h2Away  = (ftAway != null && htAway != null) ? ftAway - htAway : null;

    switch (pick.statKey) {
      // Gols totais
      case 'total_goals':
        return (ftHome != null && ftAway != null) ? ftHome + ftAway : undefined;
      case 'ht_total_goals':
        return (htHome != null && htAway != null) ? htHome + htAway : undefined;
      case '2h_total_goals':
        return (h2Home != null && h2Away != null) ? h2Home + h2Away : undefined;
      // Gols por equipe (FT)
      case 'home_score':  return ftHome  ?? undefined;
      case 'away_score':  return ftAway  ?? undefined;
      // Gols por equipe (HT)
      case 'ht_home_score': return htHome ?? undefined;
      case 'ht_away_score': return htAway ?? undefined;
      // Gols por equipe (2H = FT - HT)
      case '2h_home_score': return h2Home ?? undefined;
      case '2h_away_score': return h2Away ?? undefined;
      // Escanteios
      case 'total_corners':
        return (fsHome?.corners != null && fsAway?.corners != null)
          ? fsHome.corners + fsAway.corners : undefined;
      case 'home_corners': return fsHome?.corners ?? undefined;
      case 'away_corners': return fsAway?.corners ?? undefined;
      // Cartões
      case 'total_cards':
        return (fsHome?.yellow_cards != null && fsAway?.yellow_cards != null)
          ? fsHome.yellow_cards + fsAway.yellow_cards : undefined;
      default:
        return undefined;
    }
  }

  // ── Legado: lógica antiga (teams_history / fixture_stats / API) ──────────
  const STAT_COL_FT = { 'ESCANTEIOS': 'corners', 'CARTÃO AMARELO': 'yellow_cards', 'CHUTES': 'shots_total', 'GOLS MARCADOS': 'goals_for' };
  const STAT_COL_FS = { 'ESCANTEIOS': 'corners', 'CARTÃO AMARELO': 'yellow_cards', 'CHUTES': 'shots_total', 'GOLS MARCADOS': 'goals' };
  const STAT_COL_JSONB = { 'ESCANTEIOS': 'Corner Kicks', 'CARTÃO AMARELO': 'Yellow Cards', 'CHUTES': 'Total Shots' };
  const STAT_API_TYPE = { 'ESCANTEIOS': 'Corner Kicks', 'CARTÃO AMARELO': 'Yellow Cards', 'CHUTES': 'Total Shots' };

  const teamTarget = pick.teamTarget || 'HOME';
  const stat = pick.stat;
  const period = pick.period || 'FT';

  // GOLS via placar
  if (stat === 'GOLS MARCADOS' && fxRow) {
    const val = teamTarget === 'HOME' ? fxRow.home_score : fxRow.away_score;
    return val ?? undefined;
  }

  // teams_history
  const hist = teamTarget === 'HOME' ? histHome : histAway;
  if (hist) {
    if (period === 'FT') {
      const col = STAT_COL_FT[stat];
      if (col !== undefined && hist[col] != null) return hist[col];
    } else {
      const jsonbCol = period === 'HT' ? 'stats_1h' : 'stats_2h';
      const apiType = STAT_COL_JSONB[stat];
      if (apiType) {
        const found = (hist[jsonbCol] || []).find(s => s.type === apiType);
        if (found && found.value != null) {
          if (typeof found.value === 'string') return parseInt(found.value) || 0;
          return Number(found.value) || 0;
        }
      }
    }
  }

  // fixture_stats (FT only)
  if (period === 'FT') {
    const fs = teamTarget === 'HOME' ? fsHome : fsAway;
    if (fs) {
      const col = STAT_COL_FS[stat];
      if (col !== undefined && fs[col] != null) return fs[col];
    }
  }

  // API-Football statistics
  if (period === 'FT' && apiStatsArr) {
    const teamApiId = teamTarget === 'HOME' ? homeTeamApiId : awayTeamApiId;
    const teamEntry = (apiStatsArr || []).find(e => e.team?.id === teamApiId);
    if (teamEntry) {
      const apiType = STAT_API_TYPE[stat];
      if (apiType) {
        const found = (teamEntry.statistics || []).find(s => s.type === apiType);
        if (found && found.value != null) {
          if (typeof found.value === 'string' && found.value.includes('%')) return parseInt(found.value);
          return parseInt(found.value) || 0;
        }
      }
    }
  }

  return undefined;
}

function evaluatePick(pick, actual) {
  if (actual === undefined || actual === null) return null;
  const threshold = pick.threshold ?? parseFloat(String(pick.line).replace(/.*de\s+/i, ''));
  if (isNaN(threshold)) return null;
  return (pick.type === 'OVER' ? actual > threshold : actual < threshold) ? 'WON' : 'LOST';
}

// ─── Validação de odds ────────────────────────────────────────────────────────

function validateOdds(entries, storedTotal) {
  // Para novos picks (odds reais), apenas valida se o produto bate
  let computedTotal = 1.0;
  for (const entry of entries) {
    let matchOdd = 1.0;
    for (const pick of entry.picks) {
      matchOdd *= pick.odd;
      computedTotal *= pick.odd;
    }
    console.log(`  ${entry.home} x ${entry.away}: odd combinada = ${matchOdd.toFixed(4)}`);
  }
  const computed = parseFloat(computedTotal.toFixed(2));
  const stored = parseFloat(storedTotal);
  if (Math.abs(computed - stored) > 0.05)
    console.log(`  ⚠️  total_odd ${storedTotal} ≠ calculada ${computed}`);
  else
    console.log(`  ✓ total_odd OK: ${storedTotal} (calculada ${computed})`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  const since = process.argv[2] || '2026-04-21';
  console.log(`\n=== Resolvendo bilhetes desde ${since} ===\n`);

  const { data: tickets, error } = await supabase
    .from('odd_tickets').select('*').gte('date', since).order('date', { ascending: true });

  if (error) { console.error(error.message); process.exit(1); }
  if (!tickets?.length) { console.log('Nenhum bilhete encontrado.'); return; }
  console.log(`${tickets.length} bilhete(s).\n`);

  for (const ticket of tickets) {
    const entries = ticket.ticket_data.entries;
    const fixtureApiIds = entries.map(e => e.fixture_id);

    console.log(`\n─── ${ticket.date} │ ODD ${ticket.total_odd} │ Status: ${ticket.status} ───`);
    console.log('\n[Odds]');
    validateOdds(entries, ticket.total_odd);

    if (ticket.status !== 'PENDING') {
      console.log(`\n[Resultado: ${ticket.status}]`);
      entries.flatMap(e => e.picks.map(p => ({ entry: e, pick: p }))).forEach(({ entry, pick }) => {
        const icon = pick.result === 'WON' ? '✓' : pick.result === 'LOST' ? '✗' : '?';
        console.log(`  ${icon} ${entry.home} x ${entry.away} | ${pick.period} | ${pick.team}: ${pick.line} ${pick.stat} → ${pick.result ?? '?'}`);
      });
      continue;
    }

    // ── Carrega dados do banco ─────────────────────────────────────────────
    const { data: fixtureRows } = await supabase
      .from('fixtures')
      .select('id, api_id, home_team_id, away_team_id, home_score, away_score, ht_home_score, ht_away_score, status')
      .in('api_id', fixtureApiIds);
    const fxMap = Object.fromEntries((fixtureRows || []).map(f => [f.api_id, f]));

    // teams_history
    const { data: histData } = await supabase
      .from('teams_history')
      .select('fixture_id, is_home, goals_for, corners, yellow_cards, shots_total, stats_1h, stats_2h')
      .in('fixture_id', fixtureApiIds);
    const histHomeMap = {}, histAwayMap = {};
    (histData || []).forEach(h => {
      if (h.is_home) histHomeMap[h.fixture_id] = h;
      else histAwayMap[h.fixture_id] = h;
    });

    // fixture_stats (FT)
    const internalIds = (fixtureRows || []).map(f => f.id);
    const fsHomeMap = {}, fsAwayMap = {};
    if (internalIds.length > 0) {
      const { data: fsRows } = await supabase
        .from('fixture_stats')
        .select('fixture_id, team_id, corners, yellow_cards, shots_total, goals')
        .in('fixture_id', internalIds).eq('period', 'FT');
      (fsRows || []).forEach(r => {
        const fx = (fixtureRows || []).find(f => f.id === r.fixture_id);
        if (!fx) return;
        if (r.team_id === fx.home_team_id) fsHomeMap[fx.api_id] = r;
        else if (r.team_id === fx.away_team_id) fsAwayMap[fx.api_id] = r;
      });
    }

    // team api_ids (para API fallback)
    const allTeamInternalIds = [...new Set((fixtureRows || []).flatMap(f => [f.home_team_id, f.away_team_id]).filter(Boolean))];
    const teamIntToApi = {};
    if (allTeamInternalIds.length > 0) {
      const { data: teamRows } = await supabase.from('teams').select('id, api_id').in('id', allTeamInternalIds);
      (teamRows || []).forEach(t => { teamIntToApi[t.id] = t.api_id; });
    }

    // Quais fixtures precisam da API (sem dados locais suficientes)
    const needsApi = new Set();
    for (const entry of entries) {
      const fx = fxMap[entry.fixture_id];
      if (!fx || !['FT', 'AET', 'PEN'].includes(fx.status)) continue;
      const hasLocal = histHomeMap[entry.fixture_id] || histAwayMap[entry.fixture_id]
                    || fsHomeMap[entry.fixture_id] || fsAwayMap[entry.fixture_id];
      // Para picks novos (statKey), goals vêm do fxRow; corners/cards podem precisar da API
      const hasNewStatKeys = entry.picks.every(p => p.statKey && ['total_goals','home_score','away_score','ht_total_goals'].includes(p.statKey));
      if (!hasLocal && !hasNewStatKeys) needsApi.add(entry.fixture_id);
    }

    const apiStatsCache = {};
    for (const fid of needsApi) {
      const fx = fxMap[fid];
      if (!fx || !['FT', 'AET', 'PEN'].includes(fx.status)) continue;
      process.stdout.write(`  🌐 API stats fixture ${fid}... `);
      try {
        const resp = await fetchApi(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}`);
        apiStatsCache[fid] = resp;
        console.log('ok');
        await delay(1000);
      } catch (e) { console.log(`erro: ${e.message}`); }
    }

    // ── Avalia picks ──────────────────────────────────────────────────────
    console.log('\n[Picks]');
    let ticketWon = true;
    let anyPending = false;

    const updatedEntries = entries.map(entry => {
      const fx = fxMap[entry.fixture_id];
      const homeTeamApiId = fx ? teamIntToApi[fx.home_team_id] : undefined;
      const awayTeamApiId = fx ? teamIntToApi[fx.away_team_id] : undefined;
      let matchWon = true;

      const updatedPicks = entry.picks.map(pick => {
        const actual = getActualValue({
          pick,
          fxRow: fx,
          fsHome: fsHomeMap[entry.fixture_id],
          fsAway: fsAwayMap[entry.fixture_id],
          histHome: histHomeMap[entry.fixture_id],
          histAway: histAwayMap[entry.fixture_id],
          apiStatsArr: apiStatsCache[entry.fixture_id],
          homeTeamApiId,
          awayTeamApiId,
        });

        const result = evaluatePick(pick, actual);
        const icon = result === 'WON' ? '✓' : result === 'LOST' ? '✗' : '?';
        const actualStr = actual !== undefined ? `fez: ${actual}` : 'sem dado';
        const label = pick.market ? `[${pick.market}]` : `[${pick.stat}]`;
        console.log(`  ${icon} ${entry.home} x ${entry.away} | ${pick.period} | ${pick.team}: ${pick.line} ${pick.stat} → ${result ?? 'PENDENTE'} (${actualStr}) ${label}`);

        if (result === 'LOST') matchWon = false;
        if (result === null) anyPending = true;
        return { ...pick, result: result ?? undefined };
      });

      if (!matchWon) ticketWon = false;
      return { ...entry, result: matchWon ? 'WON' : 'LOST', picks: updatedPicks };
    });

    // ── Decisão ──────────────────────────────────────────────────────────
    if (anyPending && ticketWon) {
      console.log('\n  → Picks sem dado, nenhum LOST confirmado. PENDING.');
      const noData = entries.filter(e => {
        const fx = fxMap[e.fixture_id];
        return !fx || !['FT', 'AET', 'PEN'].includes(fx.status);
      });
      noData.forEach(e => console.log(`    ⏩ ${e.home} x ${e.away}: status ${fxMap[e.fixture_id]?.status ?? 'desconhecido'}`));
      continue;
    }
    if (anyPending && !ticketWon) console.log('\n  → LOST confirmado com picks pendentes. Resolvendo como LOST.');

    const newStatus = ticketWon ? 'WON' : 'LOST';
    console.log(`\n  → Resultado: ${newStatus}`);

    const { error: updErr } = await supabase
      .from('odd_tickets')
      .update({ status: newStatus, ticket_data: { ...ticket.ticket_data, entries: updatedEntries } })
      .eq('date', ticket.date);

    if (updErr) console.log(`  ⚠️  Erro ao salvar: ${updErr.message}`);
    else console.log(`  ✓ Salvo como ${newStatus}.`);
  }

  console.log('\n=== Concluído ===\n');
}

run().catch(console.error);
