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

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function fetchWithRetry(url) {
  let retries = 3;
  while (retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
      return data;
    } catch (err) {
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if (retries === 0) throw err;
    }
  }
}

const extractStat = (stats, typeStr) => {
  const s = stats.find(s => s.type === typeStr);
  if (s && s.value !== null) {
    if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value.replace('%', ''), 10);
    return parseInt(s.value, 10);
  }
  return 0;
};

async function updateYesterdayResults() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  console.log(`=== Updating results for ${dateStr} ===\n`);

  // 1. Fetch all fixtures for yesterday from the API
  const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`);
  const matches = (data.response || []).filter(m => LEAGUES_TO_SYNC.includes(m.league.id));
  const finishedMatches = matches.filter(m => ['FT', 'AET', 'PEN'].includes(m.fixture.status.short));

  console.log(`Found ${finishedMatches.length} finished matches from tracked leagues.\n`);

  for (const m of finishedMatches) {
    const apiId = m.fixture.id;
    const homeId = m.teams.home.id;
    const awayId = m.teams.away.id;

    // 2. Update fixture scores in the DB
    const { error: fixError } = await supabase.from('fixtures').update({
      status: m.fixture.status.short,
      home_score: m.goals.home,
      away_score: m.goals.away,
      ht_home_score: m.score.halftime.home,
      ht_away_score: m.score.halftime.away
    }).eq('api_id', apiId);

    if (fixError) {
      console.error(`Error updating fixture ${apiId}:`, fixError.message);
    } else {
      console.log(`✓ Updated score: ${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`);
    }

    // 3. Ingest stats for both teams if not already in teams_history
    const statsRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${apiId}`);
    await new Promise(r => setTimeout(r, 1000));

    const allStats = statsRes.response || [];

    for (const teamId of [homeId, awayId]) {
      const { data: existing } = await supabase.from('teams_history').select('id').eq('fixture_id', apiId).eq('team_id', teamId).single();
      if (existing) continue;

      const myStats = allStats.find(ts => ts.team.id === teamId);
      if (!myStats) continue;

      const isHome = teamId === homeId;
      const record = {
        fixture_id: apiId,
        team_id: teamId,
        opponent_id: isHome ? awayId : homeId,
        is_home: isHome,
        season: m.league.season,
        league_id: m.league.id,
        match_date: m.fixture.date,
        goals_for: isHome ? m.goals.home : m.goals.away,
        goals_against: isHome ? m.goals.away : m.goals.home,
        shots_total: extractStat(myStats.statistics, 'Total Shots'),
        shots_on_goal: extractStat(myStats.statistics, 'Shots on Goal'),
        corners: extractStat(myStats.statistics, 'Corner Kicks'),
        yellow_cards: extractStat(myStats.statistics, 'Yellow Cards'),
        red_cards: extractStat(myStats.statistics, 'Red Cards'),
        possession: extractStat(myStats.statistics, 'Ball Possession'),
        fouls: extractStat(myStats.statistics, 'Fouls'),
        offsides: extractStat(myStats.statistics, 'Offsides'),
        goalkeeper_saves: extractStat(myStats.statistics, 'Goalkeeper Saves'),
        passes_accurate: extractStat(myStats.statistics, 'Passes accurate')
      };

      const { error } = await supabase.from('teams_history').insert([record]);
      if (error) {
        console.error(`  Error saving stats for team ${teamId}:`, error.message);
      } else {
        console.log(`  + Saved ${isHome ? 'HOME' : 'AWAY'} stats for team ${teamId}`);
      }
    }
  }

  console.log(`\n=== Update complete ===`);
}

updateYesterdayResults().catch(console.error);
