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
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEAGUES_TO_SYNC = [39, 140, 135, 78, 61, 94, 71, 2];
const SEASON = 2025;

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

async function runSeederForTeamId(TEAM_ID, LEAGUE_ID) {
    console.log(`Checking history for Team ${TEAM_ID} in League ${LEAGUE_ID}...`);
    
    const { count } = await supabase
        .from('teams_history')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', TEAM_ID)
        .eq('league_id', LEAGUE_ID);
        
    if (count && count >= 30) {
        console.log(`Team ${TEAM_ID} already has ${count} records. Skipping.`);
        return;
    }

    console.log(`Team ${TEAM_ID} has ${count || 0} records. Ingesting 40 games...`);
    const fixtureRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?team=${TEAM_ID}&league=${LEAGUE_ID}&season=${SEASON}`);
    
    if(!fixtureRes?.response) return;

    let finishedMatches = fixtureRes.response.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));
    finishedMatches.sort((a,b) => b.fixture.timestamp - a.fixture.timestamp);
    const matchesToProcess = finishedMatches.slice(0, 40);
    
    for(const fixtureData of matchesToProcess) {
        const fixtureId = fixtureData.fixture.id;
        const isHome = fixtureData.teams.home.id === TEAM_ID;
        const opponentId = isHome ? fixtureData.teams.away.id : fixtureData.teams.home.id;
        
        const { data: existing } = await supabase.from('teams_history').select('id').eq('fixture_id', fixtureId).eq('team_id', TEAM_ID).single();
        if(existing) continue;

        console.log(`  - Fetching stats for fixture ${fixtureId}...`);
        const statsRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`);
        await new Promise(r => setTimeout(r, 1000));

        const teamStatsList = statsRes.response || [];
        const myStatsRaw = teamStatsList.find(ts => ts.team.id === TEAM_ID);
        
        if (!myStatsRaw) continue;

        const extractStat = (typeStr) => {
            const s = myStatsRaw.statistics.find(s => s.type === typeStr);
            if (s && s.value !== null) {
                if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value.replace('%', ''), 10);
                return parseInt(s.value, 10);
            }
            return 0;
        };

        const record = {
            fixture_id: fixtureId, team_id: TEAM_ID, opponent_id: opponentId, is_home: isHome, season: SEASON, league_id: LEAGUE_ID, match_date: fixtureData.fixture.date,
            goals_for: isHome ? fixtureData.goals.home : fixtureData.goals.away, goals_against: isHome ? fixtureData.goals.away : fixtureData.goals.home,
            shots_total: extractStat('Total Shots'), shots_on_goal: extractStat('Shots on Goal'), corners: extractStat('Corner Kicks'), yellow_cards: extractStat('Yellow Cards'),
            red_cards: extractStat('Red Cards'), possession: extractStat('Ball Possession'), fouls: extractStat('Fouls'), offsides: extractStat('Offsides'),
            goalkeeper_saves: extractStat('Goalkeeper Saves'), passes_accurate: extractStat('Passes accurate')
        };

        await supabase.from('teams_history').insert([record]);
    }
}

async function massIngest() {
  console.log('--- STARTING MASS INGESTION (Next 7 Days) ---');
  
  const today = new Date();
  const uniqueTeamLeague = new Set();
  
  for (let i = 0; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`\nFixtures for ${dateStr}...`);
    const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`);
    const matches = (data.response || []).filter(m => LEAGUES_TO_SYNC.includes(m.league.id));
    
    if (matches.length === 0) continue;

    // Sync Leagues & Teams first (Standard syncLobby logic)
    for (const m of matches) {
        await supabase.from('leagues').upsert({ id: m.league.id, api_id: m.league.id, name: m.league.name, country: m.league.country, logo_url: m.league.logo, season: m.league.season, is_active: true }, { onConflict: 'id' });
        await supabase.from('teams').upsert({ id: m.teams.home.id, api_id: m.teams.home.id, name: m.teams.home.name, logo_url: m.teams.home.logo, league_id: m.league.id }, { onConflict: 'id' });
        await supabase.from('teams').upsert({ id: m.teams.away.id, api_id: m.teams.away.id, name: m.teams.away.name, logo_url: m.teams.away.logo, league_id: m.league.id }, { onConflict: 'id' });
        
        await supabase.from('fixtures').upsert({
            api_id: m.fixture.id, league_id: m.league.id, home_team_id: m.teams.home.id, away_team_id: m.teams.away.id, date: m.fixture.date, status: m.fixture.status.short,
            home_score: m.goals.home, away_score: m.goals.away, venue: m.fixture.venue.name, round: m.league.round, season: m.league.season
        }, { onConflict: 'api_id' });

        uniqueTeamLeague.add(`${m.teams.home.id}|${m.league.id}`);
        uniqueTeamLeague.add(`${m.teams.away.id}|${m.league.id}`);
    }
  }

  console.log(`\n--- Fixtures synced. Found ${uniqueTeamLeague.size} teams to check history. ---`);

  for (const pair of uniqueTeamLeague) {
     const [tid, lid] = pair.split('|').map(Number);
     await runSeederForTeamId(tid, lid);
     await new Promise(r => setTimeout(r, 2000)); // Rate limiting safety
  }

  console.log('\n--- MASS INGESTION COMPLETED ---');
}

massIngest().catch(console.error);
