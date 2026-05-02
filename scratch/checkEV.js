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

const BOOKMAKER_ID = 8;      

const MARKETS = {
  5:  { label: 'Gols FT (Total)',    stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  45: { label: 'Escanteios FT (Total)',stat:'ESCANTEIOS',period: 'FT', teamTarget: 'TOTAL' },
  57: { label: 'Escanteios FT (Casa)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'HOME'  },
  58: { label: 'Escanteios FT (Fora)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY'  },
  80: { label: 'Cartões FT (Total)',  stat: 'CARTÕES',    period: 'FT', teamTarget: 'TOTAL' },
  81: { label: 'Cartões FT (Casa)',   stat: 'CARTÕES',    period: 'FT', teamTarget: 'HOME'  },
  82: { label: 'Cartões FT (Fora)',   stat: 'CARTÕES',    period: 'FT', teamTarget: 'AWAY'  },
};

function evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals) {
  let homeHits = 0, awayHits = 0;
  for (const match of homeHistory) {
    let actualValue = 0;
    if (candidate.stat === 'GOLS') actualValue = candidate.teamTarget === 'TOTAL' ? match.goals_for + match.goals_against : (candidate.teamTarget === 'HOME' ? match.goals_for : match.goals_against);
    else if (candidate.stat === 'ESCANTEIOS') actualValue = candidate.teamTarget === 'TOTAL' ? matchTotals[match.fixture_id]?.corners : match.corners;
    else if (candidate.stat === 'CARTÕES') actualValue = candidate.teamTarget === 'TOTAL' ? matchTotals[match.fixture_id]?.cards : (match.stats_ft?.find(s=>s.type==='Yellow Cards')?.value||0);
    
    if (candidate.type === 'OVER' && actualValue > candidate.threshold) homeHits++;
    if (candidate.type === 'UNDER' && actualValue < candidate.threshold) homeHits++;
  }

  for (const match of awayHistory) {
    let actualValue = 0;
    if (candidate.stat === 'GOLS') actualValue = candidate.teamTarget === 'TOTAL' ? match.goals_for + match.goals_against : (candidate.teamTarget === 'HOME' ? match.goals_against : match.goals_for);
    else if (candidate.stat === 'ESCANTEIOS') actualValue = candidate.teamTarget === 'TOTAL' ? matchTotals[match.fixture_id]?.corners : match.corners;
    else if (candidate.stat === 'CARTÕES') actualValue = candidate.teamTarget === 'TOTAL' ? matchTotals[match.fixture_id]?.cards : (match.stats_ft?.find(s=>s.type==='Yellow Cards')?.value||0);
    
    if (candidate.type === 'OVER' && actualValue > candidate.threshold) awayHits++;
    if (candidate.type === 'UNDER' && actualValue < candidate.threshold) awayHits++;
  }

  if (candidate.teamTarget === 'TOTAL' || (candidate.stat === 'GOLS')) {
    return ((homeHits + awayHits) / (homeHistory.length + awayHistory.length)) * 100;
  } else if (candidate.teamTarget === 'HOME') {
    return (homeHits / homeHistory.length) * 100;
  } else {
    return (awayHits / awayHistory.length) * 100;
  }
}

async function run() {
  // Let's get the 6 fixtures from today that had candidates
  const { data: fixtures } = await supabase.from('fixtures').select('*').in('api_id', [1365518, 1378204, 1146205, 1142517]).limit(4);
  
  for (const fix of fixtures) {
    console.log('\n--- Fixture', fix.api_id, '---');
    const { data: homeHistory } = await supabase.from('teams_history').select('*').eq('team_id', fix.home_team_id).eq('season', fix.season).eq('is_home', true);
    const { data: awayHistory } = await supabase.from('teams_history').select('*').eq('team_id', fix.away_team_id).eq('season', fix.season).eq('is_home', false);
    
    const historyFixtures = [...(homeHistory||[]), ...(awayHistory||[])].map(h => h.fixture_id);
    const { data: opponentsData } = await supabase.from('teams_history').select('fixture_id, corners, stats_ft').in('fixture_id', historyFixtures);
    
    const matchTotals = {};
    for (const row of (opponentsData || [])) {
      if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, cards: 0 };
      matchTotals[row.fixture_id].corners += (row.corners || 0);
      const y = row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
      const r = row.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0;
      matchTotals[row.fixture_id].cards += (y + r);
    }

    const r = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fix.api_id}&bookmaker=8`, { headers: API_HEADERS });
    const d = await r.json();
    const bet365 = d.response[0]?.bookmakers[0];
    
    console.log(`History: Home ${homeHistory.length}, Away ${awayHistory.length}`);
    
    for (const bet of (bet365?.bets || [])) {
      const market = MARKETS[bet.id];
      if (!market) continue;
      for (const v of (bet.values || [])) {
        const m = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
        if (!m) continue;
        const type = m[1].toUpperCase(); 
        const threshold = parseFloat(m[2]);
        
        const candidate = { stat: market.stat, period: market.period, teamTarget: market.teamTarget, type, threshold };
        const prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals);
        
        if (market.stat !== 'GOLS') {
          console.log(`[${market.stat} ${market.teamTarget}] ${type} ${threshold}: ${Math.round(prob)}% (Odd ${v.odd})`);
        }
      }
    }
  }
}
run();
