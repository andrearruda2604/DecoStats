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
const API_KEY = env['VITE_API_FOOTBALL_KEY'] || 'd5815b50acea81aba8152a13c20209c0';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const LEAGUES_TO_SYNC = [39, 140, 135, 78, 61, 94, 71, 2];

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

async function syncFutureFixtures() {
  console.log('Starting Future Fixtures Sync (Next 7 days)...');
  
  const today = new Date();
  
  for (let i = 0; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`\nFetching fixtures for ${dateStr}...`);
    const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`);
    const matches = data.response || [];
    
    // Filter for our mapped leagues
    const validMatches = matches.filter(m => LEAGUES_TO_SYNC.includes(m.league.id));
    console.log(`Found ${validMatches.length} matches across tracked leagues on ${dateStr}`);
    
    if (validMatches.length === 0) continue;
    
    // UPSERT Leagues
    const leaguesMap = new Map();
    validMatches.forEach(m => leaguesMap.set(m.league.id, m.league));
    for (const [id, leagueData] of leaguesMap) {
      await supabase.from('leagues').upsert({
         api_id: leagueData.id,
         name: leagueData.name,
         country: leagueData.country,
         country_code: leagueData.flag?.split('/').pop().substring(0,2).toUpperCase() || 'XX',
         logo_url: leagueData.logo,
         season: leagueData.season,
         is_active: true
      }, { onConflict: 'api_id' });
    }
    
    // Get DB IDs for Leagues
    const { data: dbLeagues } = await supabase.from('leagues').select('id, api_id').in('api_id', Array.from(leaguesMap.keys()));
    const leagueDbId = (apiId) => dbLeagues.find(l => l.api_id === apiId)?.id;

    // UPSERT Teams
    const teamsMap = new Map();
    validMatches.forEach(m => {
      teamsMap.set(m.teams.home.id, { ...m.teams.home, league_id: m.league.id });
      teamsMap.set(m.teams.away.id, { ...m.teams.away, league_id: m.league.id });
    });
    
    for (const [id, teamData] of teamsMap) {
      await supabase.from('teams').upsert({
        api_id: teamData.id,
        name: teamData.name,
        short_name: teamData.name?.substring(0, 3).toUpperCase(),
        logo_url: teamData.logo,
        league_id: leagueDbId(teamData.league_id)
      }, { onConflict: 'api_id' });
    }
    
    const { data: dbTeams } = await supabase.from('teams').select('id, api_id').in('api_id', Array.from(teamsMap.keys()));
    const teamDbId = (apiId) => dbTeams.find(t => t.api_id === apiId)?.id;
    
    // UPSERT Fixtures
    const fixturesToInsert = validMatches.map(m => ({
       api_id: m.fixture.id,
       league_id: leagueDbId(m.league.id),
       home_team_id: teamDbId(m.teams.home.id),
       away_team_id: teamDbId(m.teams.away.id),
       date: m.fixture.date,
       status: m.fixture.status.short,
       home_score: m.goals.home,
       away_score: m.goals.away,
       ht_home_score: m.score.halftime.home,
       ht_away_score: m.score.halftime.away,
       venue: m.fixture.venue.name,
       round: m.league.round,
       season: m.league.season
    }));
    
    // Batch upsert maximum 100 rows per call
    const batchSize = 100;
    for (let j = 0; j < fixturesToInsert.length; j += batchSize) {
        const batch = fixturesToInsert.slice(j, j + batchSize);
        const { error } = await supabase.from('fixtures').upsert(batch, { onConflict: 'api_id' });
        if (error) console.error("Error upserting fixtures:", error);
    }
    
    console.log(`Saved ${fixturesToInsert.length} matches securely to Database.`);
    await new Promise(r => setTimeout(r, 1000)); // Sleep to prevent flood
  }
}

syncFutureFixtures().then(() => console.log('Done.')).catch(console.error);
