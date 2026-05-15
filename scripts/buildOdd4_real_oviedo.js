/**
 * Dois bilhetes Odd 4.0 — Real Madrid vs Oviedo (2026-05-14)
 * Fixture api_id: 1391176
 * Modo: '4.0a' e '4.0b'
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
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
Object.keys(process.env).forEach(k => { if (!env[k]) env[k] = process.env[k]; });

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

const FIXTURE_API_ID = 1391176;
const TARGET_DATE    = '2026-05-14';
const BOOKMAKER_ID   = 8; // Bet365
const MIN_GAMES      = 6;
const MIN_PROB       = 70;
const TARGET_LOW     = 3.8;
const TARGET_HIGH    = 5.2;

const MARKETS = {
  5:  { label: 'Gols JOGO (Total)',       stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  16: { label: 'Gols JOGO (Casa)',        stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols JOGO (Fora)',        stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
  45: { label: 'Escanteios JOGO (Total)', stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'TOTAL' },
  57: { label: 'Escanteios JOGO (Casa)',  stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'HOME'  },
  58: { label: 'Escanteios JOGO (Fora)',  stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY'  },
  80: { label: 'Cartões JOGO (Total)',    stat: 'CARTÕES',    period: 'FT', teamTarget: 'TOTAL' },
  82: { label: 'Cartões JOGO (Casa)',     stat: 'CARTÕES',    period: 'FT', teamTarget: 'HOME'  },
  83: { label: 'Cartões JOGO (Fora)',     stat: 'CARTÕES',    period: 'FT', teamTarget: 'AWAY'  },
  87: { label: 'Chutes ao Gol (Total)',   stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'TOTAL' },
  88: { label: 'Chutes ao Gol (Casa)',    stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'HOME'  },
  89: { label: 'Chutes ao Gol (Fora)',    stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'AWAY'  },
};

async function fetchApi(url) {
  const r = await fetch(url, { headers: API_HEADERS });
  const d = await r.json();
  if (d.errors && Object.keys(d.errors).length > 0) throw new Error(JSON.stringify(d.errors));
  return d.response || [];
}

function evalFreq(candidate, homeHist, awayHist, matchTotals) {
  let hits = 0, valid = 0;
  const lists = candidate.teamTarget === 'TOTAL'
    ? [...(homeHist || []), ...(awayHist || [])]
    : candidate.teamTarget === 'HOME' ? (homeHist || []) : (awayHist || []);

  for (const m of lists) {
    let val = null;

    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') {
        if (candidate.teamTarget === 'TOTAL') val = (m.goals_for || 0) + (m.goals_against || 0);
        else if (candidate.teamTarget === 'HOME') val = m.is_home ? (m.goals_for || 0) : (m.goals_against || 0);
        else val = m.is_home ? (m.goals_against || 0) : (m.goals_for || 0);
      }
    } else if (candidate.stat === 'ESCANTEIOS') {
      if (candidate.teamTarget === 'TOTAL') {
        const tot = matchTotals[m.fixture_id];
        if (tot?.corners != null) val = tot.corners;
      } else {
        if (m.corners != null) val = m.corners;
      }
    } else if (candidate.stat === 'CARTÕES') {
      if (candidate.teamTarget === 'TOTAL') {
        const tot = matchTotals[m.fixture_id];
        if (tot?.cards != null) val = tot.cards;
      } else {
        const y = m.stats_ft?.find(s => s.type === 'Yellow Cards');
        const r = m.stats_ft?.find(s => s.type === 'Red Cards');
        if (y || r) val = (parseInt(y?.value) || 0) + (parseInt(r?.value) || 0);
      }
    } else if (candidate.stat === 'CHUTES_GOL') {
      if (candidate.teamTarget === 'TOTAL') {
        const tot = matchTotals[m.fixture_id];
        if (tot?.shots_on_goal_count >= 2) val = tot.shots_on_goal;
      } else {
        if (m.shots_on_goal != null) val = m.shots_on_goal;
      }
    }

    if (val != null) {
      valid++;
      if (candidate.type === 'OVER'  && val > candidate.threshold) hits++;
      if (candidate.type === 'UNDER' && val < candidate.threshold) hits++;
    }
  }

  if (valid < MIN_GAMES) return null;
  return { pct: (hits / valid) * 100, hits, total: valid };
}

function parseCandidates(fixtureId, homeName, awayName, oddsResp, homeHist, awayHist, matchTotals) {
  const bet365 = (oddsResp || []).flatMap(r => r.bookmakers || []).find(b => b.id === BOOKMAKER_ID);
  if (!bet365) { console.log('Sem odds da Bet365'); return []; }

  const candidates = [];
  for (const bet of (bet365.bets || [])) {
    const market = MARKETS[bet.id];
    if (!market) continue;

    const pairs = {};
    for (const v of (bet.values || [])) {
      const m = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!m) continue;
      const type = m[1].toUpperCase();
      const threshold = parseFloat(m[2]);
      if (!pairs[threshold]) pairs[threshold] = {};
      pairs[threshold][type] = parseFloat(v.odd);
    }

    for (const [threshStr, sides] of Object.entries(pairs)) {
      const threshold = parseFloat(threshStr);
      for (const [type, odd] of Object.entries(sides)) {
        if (odd < 1.04) continue;
        const candidate = {
          fixture_id: fixtureId, betId: bet.id,
          market: market.label, stat: market.stat, period: market.period,
          teamTarget: market.teamTarget,
          team: market.teamTarget === 'HOME' ? homeName : market.teamTarget === 'AWAY' ? awayName : 'Total',
          type, threshold,
          line: `${type === 'OVER' ? 'Mais de' : 'Menos de'} ${threshold}`,
          odd,
        };

        const histData = market.teamTarget === 'HOME'
          ? evalFreq(candidate, homeHist, null, matchTotals)
          : market.teamTarget === 'AWAY'
            ? evalFreq(candidate, awayHist, null, matchTotals)
            : evalFreq(candidate, homeHist, awayHist, matchTotals);

        if (histData && histData.pct >= MIN_PROB) {
          candidate.probability = Math.round(histData.pct);
          candidate.histHits    = histData.hits;
          candidate.histTotal   = histData.total;
          candidates.push(candidate);
        }
      }
    }
  }
  return candidates;
}

/**
 * Verifica se dois picks podem coexistir no mesmo bilhete.
 * Bloqueia: dois OVERs ou dois UNDERs no mesmo mercado (redundante/contraditório).
 * Permite: OVER + UNDER no mesmo mercado se thresholds diferentes e não contraditórios.
 */
function isCompatible(a, b) {
  if (a.stat !== b.stat || a.teamTarget !== b.teamTarget || a.period !== b.period) return true;
  if (a.type === b.type) return false; // dois OVERs ou dois UNDERs = redundante
  const over  = a.type === 'OVER'  ? a : b;
  const under = a.type === 'UNDER' ? a : b;
  return over.threshold < under.threshold; // Over 1.5 + Under 5.5 → OK; Over 3.5 + Under 2.5 → impossível
}

function buildTicket(allCandidates, sortBy = 'value') {
  const deduped = [];
  const seen = new Set();
  for (const c of allCandidates) {
    const key = `${c.betId}-${c.threshold}-${c.type}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
  }

  const value = c => c.probability * Math.log(c.odd + 0.5);

  if (sortBy === 'value') {
    // prob × log(odd): equilibra probabilidade e valor
    deduped.sort((a, b) => value(b) - value(a));
  } else if (sortBy === 'over_goals') {
    // Para bilhete B: preferência a picks OVER em gols, para diversificar
    deduped.sort((a, b) => {
      const isGoalA = a.stat === 'GOLS';
      const isGoalB = b.stat === 'GOLS';
      if (isGoalA && isGoalB && a.type !== b.type) {
        return a.type === 'OVER' ? -1 : 1; // OVER em gols vem primeiro
      }
      return value(b) - value(a);
    });
  }

  const selected = [];
  const usedKeys = new Set();
  let totalOdd = 1.0;

  for (const c of deduped) {
    if (totalOdd >= TARGET_HIGH) break;
    const key = `${c.betId}-${c.threshold}-${c.type}`;
    if (usedKeys.has(key)) continue;
    const incompatible = selected.some(s => !isCompatible(s, c));
    if (incompatible) continue;

    selected.push(c);
    usedKeys.add(key);
    totalOdd *= c.odd;

    if (totalOdd >= TARGET_LOW && selected.length >= 3) break;
  }

  return { selected, totalOdd };
}

async function main() {
  console.log(`\n=== Bilhetes Odd 4.0 — Real Madrid vs Oviedo (${TARGET_DATE}) ===\n`);

  // 1. Buscar fixture no DB
  const { data: fixRow, error: fixErr } = await supabase
    .from('fixtures')
    .select('api_id, date, season, league_id, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name, logo_url), away_team:teams!fixtures_away_team_id_fkey(api_id, name, logo_url), league:leagues!fixtures_league_id_fkey(id, api_id, name, logo_url)')
    .eq('api_id', FIXTURE_API_ID)
    .maybeSingle();

  if (fixErr || !fixRow) {
    console.error('Fixture não encontrado no DB:', fixErr?.message);
    process.exit(1);
  }

  const homeName  = fixRow.home_team?.name  || 'Real Madrid';
  const awayName  = fixRow.away_team?.name  || 'Real Oviedo';
  const homeLogo  = fixRow.home_team?.logo_url || '';
  const awayLogo  = fixRow.away_team?.logo_url  || '';
  const leagueName = fixRow.league?.name    || '';
  const leagueLogo = fixRow.league?.logo_url || '';
  const season    = fixRow.season;
  // Usar league_id (db_id) do fixture para filtrar teams_history
  const leagueDbId = fixRow.league_id;

  console.log(`Fixture: ${homeName} vs ${awayName}`);
  console.log(`Liga: ${leagueName} (db_id=${leagueDbId}), Temporada: ${season}`);
  console.log(`Home team api_id: ${fixRow.home_team?.api_id}, Away api_id: ${fixRow.away_team?.api_id}\n`);

  // 2. Histórico em casa do Real Madrid (league + season + home)
  const { data: homeHistRaw, error: homeErr } = await supabase
    .from('teams_history')
    .select('*')
    .eq('team_id', fixRow.home_team.api_id)
    .eq('season', season)
    .eq('league_id', leagueDbId)
    .eq('is_home', true);

  if (homeErr) console.error('Erro homeHistory:', homeErr.message);

  // 3. Histórico fora do Oviedo (league + season + away)
  const { data: awayHistRaw, error: awayErr } = await supabase
    .from('teams_history')
    .select('*')
    .eq('team_id', fixRow.away_team.api_id)
    .eq('season', season)
    .eq('league_id', leagueDbId)
    .eq('is_home', false);

  if (awayErr) console.error('Erro awayHistory:', awayErr.message);

  console.log(`Histórico RM em casa: ${homeHistRaw?.length || 0} jogos`);
  console.log(`Histórico Oviedo fora: ${awayHistRaw?.length || 0} jogos`);

  if (!homeHistRaw?.length && !awayHistRaw?.length) {
    console.log('\nSem histórico! Tentando sem filtro de liga...');
    // Fallback: sem filtro de liga
    const { data: hFallback } = await supabase.from('teams_history')
      .select('*')
      .eq('team_id', fixRow.home_team.api_id).eq('season', season).eq('is_home', true);
    const { data: aFallback } = await supabase.from('teams_history')
      .select('*')
      .eq('team_id', fixRow.away_team.api_id).eq('season', season).eq('is_home', false);
    console.log(`  Fallback RM casa: ${hFallback?.length || 0}, Oviedo fora: ${aFallback?.length || 0}`);
    homeHistRaw?.push(...(hFallback || []));
    awayHistRaw?.push(...(aFallback || []));
  }

  const homeHist = homeHistRaw || [];
  const awayHist = awayHistRaw || [];

  // 4. matchTotals — buscar todos os registros dos fixtures históricos
  const allFixtureIds = [...new Set([...homeHist, ...awayHist].map(h => h.fixture_id))];
  const matchTotals = {};
  if (allFixtureIds.length > 0) {
    const { data: totRows } = await supabase.from('teams_history')
      .select('fixture_id, corners, shots_total, shots_on_goal, stats_ft, stats_1h')
      .in('fixture_id', allFixtureIds);

    for (const row of (totRows || [])) {
      if (!matchTotals[row.fixture_id]) {
        matchTotals[row.fixture_id] = { corners: 0, cards: 0, shots_on_goal: 0, shots_on_goal_count: 0 };
      }
      const t = matchTotals[row.fixture_id];
      t.corners += (row.corners || 0);
      const y = parseInt(row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0);
      const r = parseInt(row.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0);
      t.cards += (y + r);
      if (row.shots_on_goal != null) {
        t.shots_on_goal += row.shots_on_goal;
        t.shots_on_goal_count++;
      }
    }
  }

  // 5. Estatísticas resumidas
  console.log('\n--- RM em Casa (gols marcados, escanteios, chutes ao gol, amarelos) ---');
  for (const m of homeHist.slice(0, 15)) {
    const yc = m.stats_ft?.find(s => s.type === 'Yellow Cards')?.value ?? '?';
    console.log(`  gols=${m.goals_for ?? '?'} escanteios=${m.corners ?? '?'} chutes_gol=${m.shots_on_goal ?? '?'} amarelos=${yc}`);
  }
  console.log('\n--- Oviedo Fora (gols marcados, escanteios, amarelos) ---');
  for (const m of awayHist.slice(0, 15)) {
    const yc = m.stats_ft?.find(s => s.type === 'Yellow Cards')?.value ?? '?';
    console.log(`  gols=${m.goals_for ?? '?'} escanteios=${m.corners ?? '?'} amarelos=${yc}`);
  }

  // Debug: matchTotals summary
  const mtEntries = Object.entries(matchTotals);
  console.log(`\nmatchTotals: ${mtEntries.length} fixtures. Amostra:`);
  for (const [fid, t] of mtEntries.slice(0, 3)) {
    console.log(`  fixture ${fid}: corners=${t.corners} shots_on_goal=${t.shots_on_goal} (count=${t.shots_on_goal_count}) cards=${t.cards}`);
  }

  // 6. Buscar odds da Bet365
  console.log('\nBuscando odds Bet365...');
  const oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${FIXTURE_API_ID}&bookmaker=${BOOKMAKER_ID}`);
  if (!oddsResp.length) {
    console.log('Sem odds disponíveis.');
    process.exit(1);
  }

  // 7. Parsear candidatos
  const candidates = parseCandidates(FIXTURE_API_ID, homeName, awayName, oddsResp, homeHist, awayHist, matchTotals);
  console.log(`\n${candidates.length} candidato(s) com prob >= ${MIN_PROB}%:`);
  for (const c of candidates.sort((a, b) => b.probability - a.probability || b.odd - a.odd)) {
    console.log(`  [${c.probability}%] ${c.market} ${c.line} @ ${c.odd}  (${c.histHits}/${c.histTotal})`);
  }

  if (candidates.length < 3) {
    console.log('\nCandidatos insuficientes para montar bilhetes. Abortando.');
    process.exit(1);
  }

  // 8. Montar Bilhete A — prioriza valor (prob × log(odd))
  const ticketA = buildTicket(candidates, 'value');
  console.log(`\n=== BILHETE A — odd total: ${ticketA.totalOdd.toFixed(2)} ===`);
  for (const p of ticketA.selected) {
    console.log(`  [${p.probability}%] ${p.market} ${p.line} @ ${p.odd}  (${p.histHits}/${p.histTotal})`);
  }

  // 9. Montar Bilhete B — prioriza OVER em gols para perfil diferente
  const ticketB = buildTicket(candidates, 'over_goals');
  console.log(`\n=== BILHETE B — odd total: ${ticketB.totalOdd.toFixed(2)} ===`);
  for (const p of ticketB.selected) {
    console.log(`  [${p.probability}%] ${p.market} ${p.line} @ ${p.odd}  (${p.histHits}/${p.histTotal})`);
  }

  if (ticketA.selected.length < 2 || ticketB.selected.length < 2) {
    console.log('\nBilhetes com picks insuficientes. Abortando salvamento.');
    process.exit(1);
  }

  // 10. Salvar no banco
  const makeEntry = (ticket) => ({
    fixture_id: FIXTURE_API_ID,
    home: homeName,
    away: awayName,
    homeLogo,
    awayLogo,
    date_time: fixRow.date,
    league_name: leagueName,
    league_logo_url: leagueLogo,
    picks: ticket.selected.map(p => ({
      team: p.team,
      stat: p.stat,
      period: p.period,
      line: p.line,
      type: p.type,
      odd: p.odd,
      probability: p.probability,
      histHits: p.histHits,
      histTotal: p.histTotal,
      market: p.market,
      teamTarget: p.teamTarget,
    })),
  });

  for (const [mode, ticket] of [['4.0a', ticketA], ['4.0b', ticketB]]) {
    const entry = makeEntry(ticket);
    const totalOdd = parseFloat(ticket.totalOdd.toFixed(2));
    const { error } = await supabase.from('odd_tickets').upsert({
      date: TARGET_DATE,
      mode,
      total_odd: totalOdd,
      matches_count: 1,
      status: 'PENDING',
      ticket_data: {
        entries: [entry],
        confidence_score: Math.min(...ticket.selected.map(p => p.probability)),
        generated_at: new Date().toISOString(),
      },
    }, { onConflict: 'date,mode' });

    if (error) console.error(`Erro ao salvar bilhete ${mode}:`, error.message);
    else console.log(`\nBilhete ${mode} salvo (odd ${totalOdd})`);
  }
}

main().catch(console.error);
