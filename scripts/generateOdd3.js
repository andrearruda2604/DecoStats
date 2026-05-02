/**
 * Bilhete Odd 3.0 — odds reais da Bet365 via API-Football
 * Alvo: múltipla ~3.00 usando picks de ALTA PROBABILIDADE HISTÓRICA
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

const TARGET_LOW  = 2.80;
const TARGET_HIGH = 3.20;
const MIN_PICKS   = 4;
const MAX_PICKS   = 12; 
const MAX_PICKS_PER_MATCH_DEFAULT = 2;
const MAX_PICKS_PER_MATCH_FEW_GAMES = 3; 

const MIN_HISTORICAL_PROB = 85; 
const MIN_ODD = 1.07;        
const MIN_GAMES_HISTORY = 3; 
const BOOKMAKER_ID = 8;      

const MARKETS = {
  5:  { label: 'Gols FT (Total)',    stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  16: { label: 'Gols FT (Casa)',     stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols FT (Fora)',     stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
  105:{ label: 'Gols 1T (Casa)',     stat: 'GOLS',       period: 'HT', teamTarget: 'HOME'  },
  106:{ label: 'Gols 1T (Fora)',     stat: 'GOLS',       period: 'HT', teamTarget: 'AWAY'  },
  107:{ label: 'Gols 2T (Casa)',     stat: 'GOLS',       period: '2H', teamTarget: 'HOME'  },
  108:{ label: 'Gols 2T (Fora)',     stat: 'GOLS',       period: '2H', teamTarget: 'AWAY'  },
  45: { label: 'Escanteios FT (Total)',stat:'ESCANTEIOS',period: 'FT', teamTarget: 'TOTAL' },
  77: { label: 'Escanteios 1T (Total)',stat:'ESCANTEIOS',period: 'HT', teamTarget: 'TOTAL' },
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

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Avalia a frequência histórica com base na equipe alvo. 
 * Comportamento clássico restaurado: usa apenas o histórico da equipe em questão para manter as altas %.
 */
function evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals) {
  if (!homeHistory || homeHistory.length < MIN_GAMES_HISTORY) return null;
  if (candidate.teamTarget === 'TOTAL' && (!awayHistory || awayHistory.length < MIN_GAMES_HISTORY)) return null;

  let homeHits = 0;
  let awayHits = 0;

  for (const match of homeHistory) {
    let actualValue = 0;
    
    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') {
        if (candidate.teamTarget === 'TOTAL') actualValue = match.goals_for + match.goals_against;
        else if (candidate.teamTarget === 'HOME') actualValue = match.is_home ? match.goals_for : match.goals_against; 
        else if (candidate.teamTarget === 'AWAY') actualValue = match.is_home ? match.goals_against : match.goals_for; 
      } else if (candidate.period === 'HT') {
        const htg = match.stats_1h?.find(s => s.type === 'goals');
        actualValue = htg ? htg.value : 0;
      } else if (candidate.period === '2H') {
        const shtg = match.stats_2h?.find(s => s.type === 'goals');
        actualValue = shtg ? shtg.value : 0;
      }
    } else if (candidate.stat === 'ESCANTEIOS') {
      if (candidate.period === 'HT') {
        if (candidate.teamTarget === 'TOTAL') {
           actualValue = matchTotals[match.fixture_id]?.corners_ht || 0;
        } else {
           const ck = match.stats_1h?.find(s => s.type === 'Corner Kicks');
           actualValue = ck ? ck.value : 0;
        }
      } else {
        if (candidate.teamTarget === 'TOTAL') actualValue = matchTotals[match.fixture_id]?.corners || 0;
        else actualValue = match.corners || 0; 
      }
    } else if (candidate.stat === 'CARTÕES') {
      if (candidate.teamTarget === 'TOTAL') actualValue = matchTotals[match.fixture_id]?.cards || 0;
      else {
        const yellow = match.stats_ft?.find(s => s.type === 'Yellow Cards');
        const red = match.stats_ft?.find(s => s.type === 'Red Cards');
        actualValue = (yellow ? yellow.value : 0) + (red ? red.value : 0);
      }
    }
    
    if (candidate.type === 'OVER' && actualValue > candidate.threshold) homeHits++;
    if (candidate.type === 'UNDER' && actualValue < candidate.threshold) homeHits++;
  }

  if (candidate.teamTarget !== 'TOTAL') {
    return (homeHits / homeHistory.length) * 100;
  }

  for (const match of awayHistory) {
    let actualValue = 0;
    
    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') actualValue = match.goals_for + match.goals_against;
      else if (candidate.period === 'HT') {
        const htg = match.stats_1h?.find(s => s.type === 'goals'); actualValue = htg ? htg.value : 0;
      } else if (candidate.period === '2H') {
        const shtg = match.stats_2h?.find(s => s.type === 'goals'); actualValue = shtg ? shtg.value : 0;
      }
    } else if (candidate.stat === 'ESCANTEIOS') {
      if (candidate.period === 'HT') actualValue = matchTotals[match.fixture_id]?.corners_ht || 0;
      else actualValue = matchTotals[match.fixture_id]?.corners || 0;
    } else if (candidate.stat === 'CARTÕES') {
      actualValue = matchTotals[match.fixture_id]?.cards || 0;
    }
    
    if (candidate.type === 'OVER' && actualValue > candidate.threshold) awayHits++;
    if (candidate.type === 'UNDER' && actualValue < candidate.threshold) awayHits++;
  }

  return ((homeHits + awayHits) / (homeHistory.length + awayHistory.length)) * 100;
}

function parseCandidatesFromOdds(fixtureId, homeName, awayName, oddsResponse, homeHistory, awayHistory, matchTotals) {
  const bet365 = (oddsResponse || [])
    .flatMap(r => r.bookmakers || [])
    .find(b => b.id === BOOKMAKER_ID);
  if (!bet365) return [];

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
      const teamName = market.teamTarget === 'HOME' ? homeName : market.teamTarget === 'AWAY' ? awayName : 'Total';

      for (const [sideKey, odd] of Object.entries(sides)) {
        if (odd < MIN_ODD) continue;

        const candidate = {
          fixture_id: fixtureId,
          betId: bet.id,
          market: market.label,
          stat: market.stat,
          period: market.period,
          teamTarget: market.teamTarget,
          team: teamName,
          type: sideKey,
          threshold,
          line: `${sideKey === 'OVER' ? 'Mais de' : 'Menos de'} ${threshold}`,
          odd,
        };

        let prob = null;
        if (market.teamTarget === 'TOTAL') {
          prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals);
        } else if (market.teamTarget === 'HOME') {
          prob = evaluateHistoricalFrequency(candidate, homeHistory, null, matchTotals);
        } else if (market.teamTarget === 'AWAY') {
          prob = evaluateHistoricalFrequency(candidate, awayHistory, null, matchTotals);
        }

        if (prob !== null && prob >= MIN_HISTORICAL_PROB) {
          candidate.probability = Math.round(prob); 
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates;
}

function buildAccumulator(allCandidates, maxPicksPerMatch = MAX_PICKS_PER_MATCH_DEFAULT) {
  const deduped = [];
  const seen = new Set();
  for (const c of allCandidates) {
    const key = `${c.fixture_id}-${c.betId}-${c.threshold}-${c.type}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
  }

  const selected = [];
  const picksPerMatch = {};
  const usedKeys = new Set();
  let currentOdd = 1.0;

  function canAdd(candidate) {
    const key = `${candidate.fixture_id}-${candidate.betId}-${candidate.threshold}-${candidate.type}`;
    if (usedKeys.has(key)) return false;
    const matchCount = picksPerMatch[candidate.fixture_id] || 0;
    if (matchCount >= maxPicksPerMatch) return false;
    return true;
  }

  function doAdd(candidate) {
    const key = `${candidate.fixture_id}-${candidate.betId}-${candidate.threshold}-${candidate.type}`;
    selected.push(candidate);
    usedKeys.add(key);
    picksPerMatch[candidate.fixture_id] = (picksPerMatch[candidate.fixture_id] || 0) + 1;
    currentOdd *= candidate.odd;
  }

  while (selected.length < MAX_PICKS) {
    if (currentOdd >= TARGET_LOW && selected.length >= MIN_PICKS) break;

    // Remove forced diversification to prioritize strict highest % and odd
    const available = deduped.filter(c => canAdd(c) && currentOdd * c.odd <= TARGET_HIGH);
    if (available.length === 0) break;

    available.sort((a, b) => b.probability - a.probability || b.odd - a.odd);
    const pick = available[0];

    doAdd(pick);
  }

  if (currentOdd < TARGET_LOW && selected.length < MAX_PICKS) {
    const maxAllowed = TARGET_HIGH + 0.15;
    const fallbacks = deduped
      .filter(c => canAdd(c))
      .filter(c => (currentOdd * c.odd) >= TARGET_LOW && (currentOdd * c.odd) <= maxAllowed)
      .sort((a, b) => b.probability - a.probability || b.odd - a.odd);

    if (fallbacks.length > 0) doAdd(fallbacks[0]);
  }

  return { selected, total: currentOdd };
}

async function generateOdd3() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = process.argv[2] || brt.toISOString().split('T')[0];
  console.log(`\n=== Gerando Bilhete Odd 3.0 para ${today} ===\n`);

  const { data: leagues } = await supabase.from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  let query = supabase
    .from('fixtures')
    .select('api_id, date, status, season, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name, logo_url), away_team:teams!fixtures_away_team_id_fkey(name, logo_url), league:leagues!fixtures_league_id_fkey(api_id)')
    .gte('date', `${today} 00:00:00`)
    .lte('date', `${today} 23:59:59`);

  if (today === brtNow) {
    query = query.in('status', ['NS', 'TBD']);
  }
  const { data: fixtures } = await query;

  const candidates = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`Fixtures disponíveis: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nenhum fixture não-iniciado encontrado para hoje. Abortando.');
    return;
  }

  const allPickCandidates = [];
  for (const f of candidates) {
    const homeName = f.home_team?.name || 'Casa';
    const awayName = f.away_team?.name || 'Fora';
    process.stdout.write(`  ${homeName} x ${awayName} ... `);

    try {
      const { data: homeHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.home_team_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', true);
      const { data: awayHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.away_team_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', false);

      const matchTotals = {};
      
      if (homeHistory?.length > 0 || awayHistory?.length > 0) {
         const historyFixtures = [...(homeHistory||[]), ...(awayHistory||[])].map(h => h.fixture_id);
         const { data: opponentsData } = await supabase.from('teams_history')
           .select('fixture_id, corners, stats_ft, stats_1h')
           .in('fixture_id', historyFixtures);
           
         for (const row of (opponentsData || [])) {
           if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, corners_ht: 0, cards: 0 };
           matchTotals[row.fixture_id].corners += (row.corners || 0);
           const ck_ht = row.stats_1h?.find(s => s.type === 'Corner Kicks');
           matchTotals[row.fixture_id].corners_ht += (ck_ht ? ck_ht.value : 0);
           const y = row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
           const r = row.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0;
           matchTotals[row.fixture_id].cards += (y + r);
         }
      }

      const oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}&bookmaker=${BOOKMAKER_ID}`);
      
      const picks = parseCandidatesFromOdds(f.api_id, homeName, awayName, oddsResp, homeHistory, awayHistory, matchTotals);
      
      if ((homeHistory?.length || 0) < MIN_GAMES_HISTORY || (awayHistory?.length || 0) < MIN_GAMES_HISTORY) {
         console.log(`Ignorado (Amostragem: Casa ${homeHistory?.length || 0}, Fora ${awayHistory?.length || 0} jogos)`);
      } else {
         console.log(`${picks.length} candidato(s) EV+`);
      }
      
      allPickCandidates.push(...picks.map(p => ({
        ...p,
        home: homeName,
        away: awayName,
        homeLogo: f.home_team?.logo_url || '',
        awayLogo: f.away_team?.logo_url || '',
        date_time: f.date,
      })));
      await delay(800);
    } catch (e) {
      console.log(`erro: ${e.message}`);
    }
  }

  console.log(`\nTotal de candidatos (EV+): ${allPickCandidates.length}`);

  if (allPickCandidates.length < MIN_PICKS) {
    console.log('Odds insuficientes disponíveis. Salvando bilhete vazio.');
    await supabase.from('odd_tickets').upsert({
      date: today,
      mode: '3.0',
      matches_count: 0, total_odd: '1.00',
      status: 'PENDING',
      ticket_data: { entries: [], confidence_score: 0, generated_at: new Date().toISOString() }
    }, { onConflict: 'date,mode' });
    return;
  }

  const uniqueFixtures = new Set(allPickCandidates.map(c => c.fixture_id));
  const maxPerMatch = uniqueFixtures.size <= 4 ? MAX_PICKS_PER_MATCH_FEW_GAMES : MAX_PICKS_PER_MATCH_DEFAULT;
  const { selected, total } = buildAccumulator(allPickCandidates, maxPerMatch);
  
  console.log(`\nPicks selecionados: ${selected.length} | Odd total: ${total.toFixed(2)}`);

  const entriesMap = {};
  for (const pick of selected) {
    if (!entriesMap[pick.fixture_id]) {
      entriesMap[pick.fixture_id] = {
        fixture_id: pick.fixture_id,
        home: pick.home,
        away: pick.away,
        homeLogo: pick.homeLogo,
        awayLogo: pick.awayLogo,
        date_time: pick.date_time,
        picks: [],
      };
    }
    entriesMap[pick.fixture_id].picks.push({
      betId: pick.betId,
      statKey: pick.statKey,
      stat: pick.stat,
      period: pick.period,
      teamTarget: pick.teamTarget,
      team: pick.team,
      type: pick.type,
      threshold: pick.threshold,
      line: pick.line,
      odd: pick.odd,
      probability: pick.probability,
      market: pick.market,
    });
  }

  const entries = Object.values(entriesMap);
  const allPicks = entries.flatMap(e => e.picks);
  const avgConfidence = Math.round(allPicks.reduce((a, b) => a + b.probability, 0) / allPicks.length);
  const totalOdd = allPicks.reduce((a, b) => a * b.odd, 1.0);

  console.log('\n── BILHETE GERADO ──');
  for (const e of entries) {
    console.log(`\n  ${e.home} x ${e.away}`);
    for (const p of e.picks) {
      console.log(`    [${p.probability}% Hist.] ${p.team}: ${p.line} ${p.stat} (${p.period}) → odd ${p.odd} [${p.market}]`);
    }
  }
  console.log(`\n  Odd Total: ${totalOdd.toFixed(2)}`);
  console.log(`  Confiança Média Histórica: ${avgConfidence}%`);

  await supabase.from('odd_tickets').upsert({
    date: today,
    mode: '3.0',
    matches_count: entries.length,
    total_odd: totalOdd.toFixed(2),
    status: 'PENDING',
    ticket_data: {
      entries,
      confidence_score: avgConfidence,
      generated_at: new Date().toISOString(),
    }
  }, { onConflict: 'date,mode' });

  console.log('\n✓ Bilhete salvo no banco.\n');
}

generateOdd3().catch(console.error);
