import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];
const API_KEY = env['VITE_API_FOOTBALL_KEY'] || env['API_FOOTBALL_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TEAMS = [34, 35]; // Newcastle, Bournemouth
const LEAGUE_ID = 39; // Premier League
const SEASON = 2025; // 25/26 season
const MAX_MATCHES_TO_SEED = 40; // More matches to filter home/away later

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function fetchWithRetry(url) {
  let retries = 3;
  while(retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      if(data.errors && Object.keys(data.errors).length > 0) {
        console.error("API Error: ", data.errors);
        throw new Error(JSON.stringify(data.errors));
      }
      return data;
    } catch(err) {
      console.warn("Fetch failed, retrying in 2s...", url);
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if(retries === 0) throw err;
    }
  }
}

async function runSeederForTeam(TEAM_ID) {
  console.log(`\n\nStarting Data Seeding for Team ${TEAM_ID} (Season: ${SEASON}, League: ${LEAGUE_ID})`);
  
  const fixtureRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?team=${TEAM_ID}&league=${LEAGUE_ID}&season=${SEASON}`);
  
  if(!fixtureRes?.response) {
      console.error("Invalid response from /fixtures!");
      return;
  }

  let finishedMatches = fixtureRes.response.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));
  finishedMatches.sort((a,b) => b.fixture.timestamp - a.fixture.timestamp);
  const matchesToProcess = finishedMatches.slice(0, MAX_MATCHES_TO_SEED);
  
  console.log(`Found ${finishedMatches.length} finished matches. Processing latest ${matchesToProcess.length}...`);

  for(let i = 0; i < matchesToProcess.length; i++) {
    const fixtureData = matchesToProcess[i];
    const fixtureId = fixtureData.fixture.id;
    const isHome = fixtureData.teams.home.id === TEAM_ID;
    const opponentId = isHome ? fixtureData.teams.away.id : fixtureData.teams.home.id;
    
    const { data: existing } = await supabase
        .from('teams_history')
        .select('id')
        .eq('fixture_id', fixtureId)
        .eq('team_id', TEAM_ID)
        .single();
        
    if(existing) {
        console.log(`[${i+1}/${matchesToProcess.length}] Fixture ${fixtureId} already in DB. Skipping stats fetch.`);
        continue;
    }

    console.log(`[${i+1}/${matchesToProcess.length}] Fetching statistics for fixture ${fixtureId}...`);
    const statsRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`);
    
    await new Promise(r => setTimeout(r, 1000));

    const teamStatsList = statsRes.response || [];
    const myStatsRaw = teamStatsList.find(ts => ts.team.id === TEAM_ID);
    
    const extractStat = (typeStr) => {
        if(!myStatsRaw) return null;
        const s = myStatsRaw.statistics.find(s => s.type === typeStr);
        if (s && s.value !== null) {
            if (typeof s.value === 'string' && s.value.includes('%')) {
                return parseInt(s.value.replace('%', ''), 10);
            }
            return parseInt(s.value, 10);
        }
        return 0;
    };

    const record = {
        fixture_id: fixtureId,
        team_id: TEAM_ID,
        opponent_id: opponentId,
        is_home: isHome,
        season: SEASON,
        league_id: LEAGUE_ID,
        match_date: fixtureData.fixture.date,
        goals_for: isHome ? fixtureData.goals.home : fixtureData.goals.away,
        goals_against: isHome ? fixtureData.goals.away : fixtureData.goals.home,
        shots_total: extractStat('Total Shots'),
        shots_on_goal: extractStat('Shots on Goal'),
        corners: extractStat('Corner Kicks'),
        yellow_cards: extractStat('Yellow Cards'),
        red_cards: extractStat('Red Cards'),
        possession: extractStat('Ball Possession'),
        fouls: extractStat('Fouls'),
        offsides: extractStat('Offsides'),
        goalkeeper_saves: extractStat('Goalkeeper Saves'),
        passes_accurate: extractStat('Passes accurate')
    };

    const { error } = await supabase.from('teams_history').insert([record]);
    
    if(error) {
        console.error(`Error saving fixture ${fixtureId}:`, error);
    } else {
        console.log(`Successfully saved stats for fixture ${fixtureId}.`);
    }
  }
}

async function run() {
    for (const tid of TEAMS) {
        await runSeederForTeam(tid);
    }
    console.log("All configured teams seeded.");
}

run();
