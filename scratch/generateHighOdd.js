/**
 * Bilhete Odd Alta (30–50) — picks com >= 60% probabilidade histórica
 * Apenas para visualização, não salva no banco.
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

const TARGET_LOW  = 30;
const TARGET_HIGH = 55;
const MIN_PICKS   = 5;
const MAX_PICKS   = 20;
const MAX_PER_MATCH = 2;

const MIN_HISTORICAL_PROB = 60;
const MIN_ODD = 1.20;
const MIN_GAMES_HISTORY = 7;
const BOOKMAKER_ID = 8;

const MARKETS = {
  5:  { label: 'Gols FT (Total)',    stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  16: { label: 'Gols FT (Casa)',     stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols FT (Fora)',     stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
  45: { label: 'Escanteios FT (Total)',stat:'ESCANTEIOS',period: 'FT', teamTarget: 'TOTAL' },
  57: { label: 'Escanteios FT (Casa)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'HOME'  },
  58: { label: 'Escanteios FT (Fora)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY'  },
  80: { label: 'Cartões FT (Total)',  stat: 'CARTÕES',    period: 'FT', teamTarget: 'TOTAL' },
  82: { label: 'Cartões FT (Casa)',   stat: 'CARTÕES',    period: 'FT', teamTarget: 'HOME'  },
  83: { label: 'Cartões FT (Fora)',   stat: 'CARTÕES',    period: 'FT', teamTarget: 'AWAY'  },
};

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

function evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals) {
  if (!homeHistory || homeHistory.length < MIN_GAMES_HISTORY) return null;
  if (candidate.teamTarget === 'TOTAL' && (!awayHistory || awayHistory.length < MIN_GAMES_HISTORY)) return null;

  let homeHits = 0, awayHits = 0;

  for (const match of homeHistory) {
    let actualValue = 0;
    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') actualValue = match.goals_for ?? 0;
    } else if (candidate.stat === 'ESCANTEIOS') {
      actualValue = matchTotals[match.fixture_id]?.corners || 0;
    } else if (candidate.stat === 'CARTÕES') {
      actualValue = matchTotals[match.fixture_id]?.cards || 0;
    }
    if (candidate.type === 'OVER' && actualValue > candidate.threshold) homeHits++;
    if (candidate.type === 'UNDER' && actualValue < candidate.threshold) homeHits++;
  }

  if (candidate.teamTarget === 'TOTAL' || candidate.teamTarget === 'AWAY') {
    for (const match of (awayHistory || [])) {
      let actualValue = 0;
      if (candidate.stat === 'GOLS') {
        if (candidate.period === 'FT') actualValue = match.goals_for ?? 0;
      } else if (candidate.stat === 'ESCANTEIOS') {
        actualValue = matchTotals[match.fixture_id]?.corners || 0;
      } else if (candidate.stat === 'CARTÕES') {
        actualValue = matchTotals[match.fixture_id]?.cards || 0;
      }
      if (candidate.type === 'OVER' && actualValue > candidate.threshold) awayHits++;
      if (candidate.type === 'UNDER' && actualValue < candidate.threshold) awayHits++;
    }
  }

  if (candidate.teamTarget === 'TOTAL') {
    return ((homeHits + awayHits) / (homeHistory.length + (awayHistory?.length || 0))) * 100;
  }
  if (candidate.teamTarget === 'AWAY') {
    return awayHistory?.length > 0 ? (awayHits / awayHistory.length) * 100 : null;
  }
  return (homeHits / homeHistory.length) * 100;
}

async function run() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const targetDate = process.argv[2] || (() => { const d = new Date(brt); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
  console.log(`\n=== Gerando Bilhete ODD ALTA (${TARGET_LOW}–${TARGET_HIGH}) para ${targetDate} ===\n`);

  const { data: leagues } = await supabase.from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('api_id, date, status, season, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name, logo_url), away_team:teams!fixtures_away_team_id_fkey(api_id, name, logo_url), league:leagues!fixtures_league_id_fkey(api_id)')
    .gte('date', `${targetDate} 00:00:00`)
    .lte('date', `${targetDate} 23:59:59`);

  const candidates = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`Fixtures disponíveis: ${candidates.length}`);

  const allPicks = [];
  for (const f of candidates) {
    const homeName = f.home_team?.name || 'Casa';
    const awayName = f.away_team?.name || 'Fora';
    process.stdout.write(`  ${homeName} x ${awayName} ... `);

    try {
      const { data: homeHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.home_team.api_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', true);
      const { data: awayHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.away_team.api_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', false);

      if ((homeHistory?.length || 0) < MIN_GAMES_HISTORY || (awayHistory?.length || 0) < MIN_GAMES_HISTORY) {
        console.log(`Ignorado (Amostragem insuficiente)`);
        continue;
      }

      const matchTotals = {};
      const historyFixtures = [...(homeHistory||[]), ...(awayHistory||[])].map(h => h.fixture_id);
      const { data: opponentsData } = await supabase.from('teams_history')
        .select('fixture_id, corners, stats_ft, stats_1h')
        .in('fixture_id', historyFixtures);
      for (const row of (opponentsData || [])) {
        if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, cards: 0 };
        matchTotals[row.fixture_id].corners += (row.corners || 0);
        const y = row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
        const r = row.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0;
        matchTotals[row.fixture_id].cards += (y + r);
      }

      const oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}&bookmaker=${BOOKMAKER_ID}`);
      const bet365 = (oddsResp || []).flatMap(r => r.bookmakers || []).find(b => b.id === BOOKMAKER_ID);
      if (!bet365) { console.log('sem odds'); continue; }

      let pickCount = 0;
      for (const bet of (bet365.bets || [])) {
        const market = MARKETS[bet.id];
        if (!market) continue;
        for (const v of (bet.values || [])) {
          const m = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
          if (!m) continue;
          const odd = parseFloat(v.odd);
          if (odd < MIN_ODD) continue;
          const candidate = {
            fixture_id: f.api_id, home: homeName, away: awayName,
            homeLogo: f.home_team?.logo_url || '', awayLogo: f.away_team?.logo_url || '',
            market: market.label, stat: market.stat, period: market.period, teamTarget: market.teamTarget,
            team: market.teamTarget === 'HOME' ? homeName : market.teamTarget === 'AWAY' ? awayName : 'Total',
            type: m[1].toUpperCase(), threshold: parseFloat(m[2]),
            line: `${m[1].toUpperCase() === 'OVER' ? 'Mais de' : 'Menos de'} ${m[2]}`,
            odd, betId: bet.id,
          };
          const prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals);
          if (prob !== null && prob >= MIN_HISTORICAL_PROB) {
            candidate.probability = Math.round(prob);
            allPicks.push(candidate);
            pickCount++;
          }
        }
      }
      console.log(`${pickCount} candidato(s)`);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`erro: ${e.message}`);
    }
  }

  console.log(`\nTotal de candidatos: ${allPicks.length}`);

  // Sort by best probability * odd combo (maximize EV)
  allPicks.sort((a, b) => (b.probability * b.odd) - (a.probability * a.odd));

  // Greedy accumulator targeting 30–50 odd
  const selected = [];
  const picksPerMatch = {};
  const usedKeys = new Set();
  let currentOdd = 1.0;

  for (const pick of allPicks) {
    if (selected.length >= MAX_PICKS) break;
    if (currentOdd >= TARGET_HIGH) break;

    const key = `${pick.fixture_id}-${pick.betId}-${pick.threshold}-${pick.type}`;
    if (usedKeys.has(key)) continue;
    const matchCount = picksPerMatch[pick.fixture_id] || 0;
    if (matchCount >= MAX_PER_MATCH) continue;

    const newOdd = currentOdd * pick.odd;
    if (newOdd > TARGET_HIGH * 1.1 && currentOdd >= TARGET_LOW) continue; // don't overshoot too much

    selected.push(pick);
    usedKeys.add(key);
    picksPerMatch[pick.fixture_id] = matchCount + 1;
    currentOdd = newOdd;
  }

  // If we're under target, add more aggressive picks
  if (currentOdd < TARGET_LOW) {
    const remaining = allPicks.filter(p => !usedKeys.has(`${p.fixture_id}-${p.betId}-${p.threshold}-${p.type}`));
    remaining.sort((a, b) => b.odd - a.odd); // prioritize higher odds now
    for (const pick of remaining) {
      if (selected.length >= MAX_PICKS) break;
      const matchCount = picksPerMatch[pick.fixture_id] || 0;
      if (matchCount >= MAX_PER_MATCH) continue;
      const key = `${pick.fixture_id}-${pick.betId}-${pick.threshold}-${pick.type}`;
      if (usedKeys.has(key)) continue;
      
      selected.push(pick);
      usedKeys.add(key);
      picksPerMatch[pick.fixture_id] = matchCount + 1;
      currentOdd *= pick.odd;
      if (currentOdd >= TARGET_LOW) break;
    }
  }

  if (selected.length === 0) {
    console.log('Nenhum pick encontrado. Abortando.');
    return;
  }

  // Group by match
  const grouped = {};
  for (const p of selected) {
    if (!grouped[p.fixture_id]) grouped[p.fixture_id] = { home: p.home, away: p.away, picks: [] };
    grouped[p.fixture_id].picks.push(p);
  }

  const avgConf = Math.round(selected.reduce((a, b) => a + b.probability, 0) / selected.length);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  🎫 BILHETE ODD ALTA — ${selected.length} picks`);
  console.log(`  💰 Odd Total: ${currentOdd.toFixed(2)}`);
  console.log(`  ⭐ Confiança Média: ${avgConf}%`);
  console.log(`${'═'.repeat(60)}\n`);

  for (const [fid, match] of Object.entries(grouped)) {
    console.log(`  ⚽ ${match.home} x ${match.away}`);
    for (const p of match.picks) {
      const emoji = p.type === 'OVER' ? '📈' : '📉';
      console.log(`     ${emoji} [${p.probability}%] ${p.team}: ${p.line} ${p.stat} → odd ${p.odd} [${p.market}]`);
    }
    console.log('');
  }

  console.log(`${'─'.repeat(60)}`);
  console.log(`  Para R$10 → Retorno potencial: R$${(10 * currentOdd).toFixed(2)}`);
  console.log(`  Para R$20 → Retorno potencial: R$${(20 * currentOdd).toFixed(2)}`);
  console.log(`${'─'.repeat(60)}\n`);
}

run().catch(console.error);
