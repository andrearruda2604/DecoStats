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

async function testQuery() {
  const today = '2026-06-15';
  let query = supabase
    .from('fixtures')
    .select('api_id, date, status')
    .gte('date', `${today} 00:00:00`)
    .lte('date', `${today} 23:59:59`);
    
  query = query.in('status', ['NS', 'TBD']);
  const { data: fixtures } = await query;
  console.log('Query using "date" string logic:', fixtures);

  // Now let's try querying ALL fixtures for the next 48h to see their actual dates
  const { data: allFixtures } = await supabase
    .from('fixtures')
    .select('api_id, date, status, home_team:home_team_id(name)')
    .in('status', ['NS', 'TBD']);
  console.log('\nAll upcoming fixtures:', allFixtures);
}

testQuery();
