import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];
const API_KEY = env['API_FOOTBALL_KEY'] || env['VITE_API_FOOTBALL_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
        console.error("API Error:", data.errors);
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

async function fetchStatsForFixture(fixtureId, teamId) {
    const statsRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}&half=true`);
    const teamStatsList = statsRes.response || [];
    return teamStatsList.find(ts => ts.team.id === teamId);
}

async function seedTeam(teamId, leagueId) {
    console.log(`\n--- Seeding Team ${teamId} (League ${leagueId}) ---`);
    
    // Check current count
    const { count } = await supabase.from('teams_history').select('*', { count: 'exact', head: true }).eq('team_id', teamId);
    if (count && count >= 20) {
        console.log(`Team ${teamId} already has ${count} records. Skipping.`);
        return;
    }

    let allMatches = [];
    
    // Try Season 2025
    console.log(`Fetching 2025 matches...`);
    const res2025 = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${leagueId}&season=2025`);
    if (res2025.response) allMatches.push(...res2025.response);

    // Try Season 2024 if we need more
    if (allMatches.length < 20) {
        console.log(`Only ${allMatches.length} matches in 2025. Fetching 2024 matches...`);
        const res2024 = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${leagueId}&season=2024`);
        if (res2024.response) allMatches.push(...res2024.response);
    }

    const finished = allMatches
        .filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short))
        .sort((a,b) => b.fixture.timestamp - a.fixture.timestamp)
        .slice(0, 30);

    console.log(`Found ${finished.length} finished matches to process.`);

    for (const f of finished) {
        const fid = f.fixture.id;
        const { data: exists } = await supabase.from('teams_history').select('id').eq('fixture_id', fid).eq('team_id', teamId).single();
        if (exists) continue;

        console.log(`  - Fetching stats for fixture ${fid}...`);
        const myStatsRaw = await fetchStatsForFixture(fid, teamId);
        await new Promise(r => setTimeout(r, 1200));

        if (!myStatsRaw) continue;

        const extractStat = (typeStr) => {
            const s = myStatsRaw.statistics?.find(s => s.type === typeStr);
            if (s && s.value !== null) {
                if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value.replace('%', ''), 10);
                return parseInt(s.value, 10);
            }
            return 0;
        };

        const isHome = f.teams.home.id === teamId;
        const record = {
            fixture_id: fid, team_id: teamId, opponent_id: isHome ? f.teams.away.id : f.teams.home.id,
            is_home: isHome, season: f.league.season, league_id: leagueId, match_date: f.fixture.date,
            goals_for: isHome ? f.goals.home : f.goals.away, goals_against: isHome ? f.goals.away : f.goals.home,
            shots_total: extractStat('Total Shots'), shots_on_goal: extractStat('Shots on Goal'), corners: extractStat('Corner Kicks'), yellow_cards: extractStat('Yellow Cards'),
            red_cards: extractStat('Red Cards'), possession: extractStat('Ball Possession'), fouls: extractStat('Fouls'), offsides: extractStat('Offsides'),
            goalkeeper_saves: extractStat('Goalkeeper Saves'), passes_accurate: extractStat('Passes accurate'),
            stats_ft: myStatsRaw.statistics || [],
            stats_1h: myStatsRaw.statistics_1h || [],
            stats_2h: myStatsRaw.statistics_2h || []
        };

        const { error: insErr } = await supabase.from('teams_history').insert([record]);
        if (insErr) console.error("    Error inserting:", insErr.message);
        else console.log(`    ✓ Saved match ${fid}`);
    }
}

async function run() {
    // Missing teams from the previous query
    const missing = [
        {id: 118, lid: 71}, {id: 119, lid: 71}, {id: 120, lid: 71}, {id: 121, lid: 71},
        {id: 124, lid: 71}, {id: 126, lid: 71}, {id: 127, lid: 71}, {id: 128, lid: 71},
        {id: 130, lid: 71}, {id: 131, lid: 71}, {id: 132, lid: 71}, {id: 133, lid: 71},
        {id: 134, lid: 71}, {id: 135, lid: 71}, {id: 136, lid: 71}, {id: 147, lid: 71},
        {id: 794, lid: 71}, {id: 1062, lid: 71}, {id: 1198, lid: 71}, {id: 7848, lid: 71}
    ];

    for (const team of missing) {
        await seedTeam(team.id, team.lid);
    }
    console.log("\nALL MISSING TEAMS PROCESSED.");
}

run().catch(console.error);
