import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
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
  const { data: teams, error } = await supabase.from('teams').select('id, api_id, name').ilike('name', '%Freiburg%');
  console.log('Freiburg teams:', teams);
  
  const { data: teams2 } = await supabase.from('teams').select('id, api_id, name').ilike('name', '%Aston%');
  console.log('Aston teams:', teams2);
}
run();
