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

async function run() {
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('id, api_id, date, home_team_id, away_team_id, status')
    .gte('date', '2026-06-05T00:00:00Z')
    .lte('date', '2026-06-06T23:59:59Z');

  if (error) {
    console.error('Error fetching fixtures:', error);
    return;
  }

  console.log(`Found ${fixtures.length} fixtures around today's date:`);
  
  const teamIds = new Set();
  fixtures.forEach(f => {
    teamIds.add(f.home_team_id);
    teamIds.add(f.away_team_id);
  });

  if (teamIds.size === 0) {
    console.log('No fixtures found.');
    return;
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .in('id', Array.from(teamIds));

  const teamMap = {};
  teams?.forEach(t => { teamMap[t.id] = t.name; });

  fixtures.forEach(f => {
    const home = teamMap[f.home_team_id] || f.home_team_id;
    const away = teamMap[f.away_team_id] || f.away_team_id;
    console.log(`- ID: ${f.id} | API_ID: ${f.api_id} | Date: ${f.date} | ${home} vs ${away} | Status: ${f.status}`);
  });
}

run().catch(console.error);
