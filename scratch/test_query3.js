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

async function checkRecent() {
  const { data, error } = await supabase.from('fixtures')
    .select('api_id, date, status, home_team:home_team_id(name), away_team:away_team_id(name)')
    .order('date', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else console.log('10 Latest fixtures in DB:', JSON.stringify(data, null, 2));
}

checkRecent();
