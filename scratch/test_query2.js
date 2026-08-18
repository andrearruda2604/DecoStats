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

async function checkDate() {
  const { data } = await supabase.from('fixtures')
    .select('api_id, date, status, home_team:home_team_id(name)')
    .like('date', '2026-06-15%');
  console.log('Games with date like 2026-06-15:', data);

  const { data: data2 } = await supabase.from('fixtures')
    .select('api_id, date, status, home_team:home_team_id(name)')
    .or('home_team_id.in.(select id from teams where name like \'%Criciuma%\'),home_team_id.in.(select id from teams where name like \'%Londrina%\')')
    .in('status', ['NS', 'TBD']);
  console.log('\nUpcoming games for Criciuma or Londrina:', data2);
}

checkDate();
