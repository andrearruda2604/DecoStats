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

async function checkFixtures() {
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log('Today:', today);

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('api_id, date, status, odds, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name), league:leagues!fixtures_league_id_fkey(name)')
    .gte('date', `${today}T00:00:00-03:00`)
    .lte('date', `${today}T23:59:59-03:00`);

  if (error) {
    console.error('Error fetching fixtures:', error);
    return;
  }

  console.log(`Found ${fixtures?.length || 0} fixtures today:`);
  for (const f of (fixtures || [])) {
    console.log(`- [${f.status}] ${f.home_team?.name} vs ${f.away_team?.name} (${f.league?.name}) [API ID: ${f.api_id}]`);
    console.log(`  Odds:`, f.odds ? `${f.odds.length} bet types` : 'null');
  }
}

checkFixtures().catch(console.error);
