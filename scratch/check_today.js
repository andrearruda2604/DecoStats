import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
  const { data } = await supabase.from('odd_tickets').select('mode, date, status, created_at').eq('date', '2026-07-08');
  console.log('Bilhetes para hoje (2026-07-08):');
  console.log(data);
  
  const nextDate = new Date(`2026-07-08T03:00:00Z`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19);

  const { data: fixtures } = await supabase.from('fixtures').select('api_id, date, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .gte('date', '2026-07-08 03:00:00')
    .lte('date', endDateStr);
    
  console.log('Fixtures no BD para hoje (2026-07-08 03:00 UTC a 2026-07-09 03:00 UTC):');
  console.log(fixtures);
}
run();
