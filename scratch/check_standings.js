import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: leagues } = await supabase.from('leagues').select('id, name').ilike('name', '%La Liga%');
  if (!leagues || !leagues.length) return console.log("La Liga not found");
  
  const { data: standings } = await supabase.from('standings').select('*').eq('league_id', leagues[0].id).order('rank');
  console.log("Standings for", leagues[0].name);
  console.log(standings.slice(0, 3));
  console.log(standings.slice(-3));
}
run();
