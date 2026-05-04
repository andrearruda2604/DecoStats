
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

const MIN_HISTORICAL_PROB = 85;
const MIN_GAMES_HISTORY = 7;
const BOOKMAKER_ID = 8;

const MARKETS = {
  5:  { label: 'Gols FT (Total)',    stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  16: { label: 'Gols FT (Casa)',     stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols FT (Fora)',     stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
  45: { label: 'Escanteios FT (Total)',stat:'ESCANTEIOS',period: 'FT', teamTarget: 'TOTAL' },
  80: { label: 'Cartões FT (Total)',  stat: 'CARTÕES',    period: 'FT', teamTarget: 'TOTAL' },
};

async function fetchApi(url) {
  const r = await fetch(url, { headers: API_HEADERS });
  const d = await r.json();
  return d.response || [];
}

function evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals) {
  const history = candidate.teamTarget === 'HOME' ? homeHistory : 
                  candidate.teamTarget === 'AWAY' ? awayHistory : 
                  [...homeHistory, ...awayHistory];

  if (!history || history.length < MIN_GAMES_HISTORY) return null;

  let hits = 0;
  for (const match of history) {
    let val = 0;
    if (candidate.stat === 'GOLS') {
        if (candidate.teamTarget === 'TOTAL') val = match.goals_for + match.goals_against;
        else if (candidate.teamTarget === 'HOME' || candidate.teamTarget === 'AWAY') {
            // Se o match no histórico é mandante, gols_for é o gol do time. Se é visitante, gols_for é o gol do time também.
            // No teams_history, goals_for é sempre o gol do time dono da linha.
            val = match.goals_for;
        }
    } else if (candidate.stat === 'ESCANTEIOS') {
        if (candidate.teamTarget === 'TOTAL') val = matchTotals[match.fixture_id]?.corners || 0;
        else val = match.corners || 0;
    } else if (candidate.stat === 'CARTÕES') {
        if (candidate.teamTarget === 'TOTAL') val = matchTotals[match.fixture_id]?.cards || 0;
        else val = (match.yellow_cards || 0) + (match.red_cards || 0);
    }
    
    const thresh = parseFloat(candidate.threshold);
    const won = candidate.type === 'OVER' ? val > thresh : val < thresh;
    if (won) hits++;
  }

  return (hits / history.length) * 100;
}

async function run() {
  const today = '2026-05-03';
  const { data: fixtures } = await supabase.from('fixtures')
    .select('api_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name), away_team:teams!fixtures_away_team_id_fkey(api_id, name), league:leagues!fixtures_league_id_fkey(api_id, season)')
    .gte('date', `${today} 00:00:00`)
    .lte('date', `${today} 23:59:59`);

  const results = [];

  for (const f of (fixtures || [])) {
    if (!f.home_team.name.includes('Bologna') && !f.home_team.name.includes('Celta')) continue;
    
    const { data: homeHistory } = await supabase.from('teams_history').select('*').eq('team_id', f.home_team.api_id).eq('is_home', true);
    const { data: awayHistory } = await supabase.from('teams_history').select('*').eq('team_id', f.away_team.api_id).eq('is_home', false);
    
    if (!homeHistory || homeHistory.length < MIN_GAMES_HISTORY) continue;
    if (!awayHistory || awayHistory.length < MIN_GAMES_HISTORY) continue;

    // Match Totals
    const ids = [...homeHistory, ...awayHistory].map(h => h.fixture_id);
    const { data: opponents } = await supabase.from('teams_history').select('fixture_id, corners, yellow_cards, red_cards').in('fixture_id', ids);
    const matchTotals = {};
    opponents?.forEach(o => {
        if (!matchTotals[o.fixture_id]) matchTotals[o.fixture_id] = { corners: 0, cards: 0 };
        matchTotals[o.fixture_id].corners += (o.corners || 0);
        matchTotals[o.fixture_id].cards += (o.yellow_cards || 0) + (o.red_cards || 0);
    });

    const odds = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}&bookmaker=${BOOKMAKER_ID}`);
    const bet365 = (odds || []).flatMap(r => r.bookmakers || []).find(b => b.id === BOOKMAKER_ID);
    if (!bet365) continue;

    for (const bet of bet365.bets) {
        const m = MARKETS[bet.id];
        if (!m) continue;
        for (const v of bet.values) {
            const match = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
            if (!match) continue;
            const odd = parseFloat(v.odd);
            if (odd < 1.05) continue;
            
            const candidate = {
                home: f.home_team.name, away: f.away_team.name,
                market: m.label, stat: m.stat, period: m.period, teamTarget: m.teamTarget,
                type: match[1].toUpperCase(), threshold: parseFloat(match[2]),
                line: v.value, odd
            };
            const prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals);
            if (prob >= 90) {
                results.push({ ...candidate, probability: prob });
            }
        }
    }
  }

  results.sort((a, b) => b.odd - a.odd);
  console.log(JSON.stringify(results, null, 2));
}

run();
