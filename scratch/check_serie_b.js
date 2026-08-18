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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// 1. Check Serie B league config
const { data: league } = await supabase.from('leagues').select('*').eq('api_id', 72).maybeSingle();
console.log('Serie B league config:', JSON.stringify(league, null, 2));

// 2. Check today's fixtures for Serie B
const { data: fixtures } = await supabase
  .from('fixtures')
  .select('api_id, date, status, season, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(id, api_id, name), away_team:teams!fixtures_away_team_id_fkey(id, api_id, name), league:leagues!fixtures_league_id_fkey(id, api_id, name)')
  .gte('date', '2026-06-14 00:00:00')
  .lte('date', '2026-06-14 23:59:59');

console.log(`\nToday's fixtures: ${fixtures?.length || 0}`);
for (const f of (fixtures || [])) {
  console.log(`  [${f.status}] ${f.home_team?.name} vs ${f.away_team?.name} (league: ${f.league?.name}, api_id: ${f.league?.api_id}, season: ${f.season})`);
  console.log(`    home_team_id: ${f.home_team_id}, api_id: ${f.home_team?.api_id}`);
  console.log(`    away_team_id: ${f.away_team_id}, api_id: ${f.away_team?.api_id}`);
}

// 3. Check teams_history for the first fixture's teams
if (fixtures?.length > 0) {
  const f = fixtures[0];
  
  // Check with the team api_id (which is what generateOdd2 uses)
  const { data: homeHist, count: homeCount } = await supabase.from('teams_history')
    .select('*', { count: 'exact' })
    .eq('team_id', f.home_team.api_id);
  console.log(`\n${f.home_team.name} (api_id=${f.home_team.api_id}) total history: ${homeCount}`);
  
  // Check with league_id and season filtering
  const { data: homeHistFiltered } = await supabase.from('teams_history')
    .select('fixture_id, match_date, is_home, season, league_id')
    .eq('team_id', f.home_team.api_id)
    .eq('league_id', f.league.api_id)
    .limit(5);
  console.log(`  With league_id=${f.league.api_id}: ${homeHistFiltered?.length || 0}`);
  if (homeHistFiltered?.length > 0) {
    homeHistFiltered.forEach(h => console.log(`    ${h.match_date} season=${h.season} league=${h.league_id} is_home=${h.is_home}`));
  }
  
  // Check with season
  const { data: homeHistSeason } = await supabase.from('teams_history')
    .select('fixture_id, match_date, is_home, season, league_id')
    .eq('team_id', f.home_team.api_id)
    .eq('season', f.season)
    .limit(5);
  console.log(`  With season=${f.season}: ${homeHistSeason?.length || 0}`);
  if (homeHistSeason?.length > 0) {
    homeHistSeason.forEach(h => console.log(`    ${h.match_date} season=${h.season} league=${h.league_id} is_home=${h.is_home}`));
  }

  // Check ALL history for this team regardless of filters
  const { data: allHist } = await supabase.from('teams_history')
    .select('fixture_id, match_date, is_home, season, league_id')
    .eq('team_id', f.home_team.api_id)
    .order('match_date', { ascending: false })
    .limit(10);
  console.log(`  ALL history (no filters): ${allHist?.length || 0}`);
  if (allHist?.length > 0) {
    allHist.forEach(h => console.log(`    ${h.match_date} season=${h.season} league=${h.league_id} is_home=${h.is_home}`));
  }
}

// 4. Check Serie B finished fixtures to understand the data
const { data: sbFixtures } = await supabase
  .from('fixtures')
  .select('api_id, date, status, season, home_team:teams!fixtures_home_team_id_fkey(api_id, name), away_team:teams!fixtures_away_team_id_fkey(api_id, name)')
  .eq('league_id', league?.id)
  .in('status', ['FT', 'AET', 'PEN'])
  .order('date', { ascending: false })
  .limit(10);
console.log(`\nSerie B finished fixtures: ${sbFixtures?.length || 0}`);
for (const f of (sbFixtures || [])) {
  console.log(`  [${f.status}] ${f.date} - ${f.home_team?.name} vs ${f.away_team?.name} (season: ${f.season})`);
}
