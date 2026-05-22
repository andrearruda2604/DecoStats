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
  const { data: fixture } = await supabase.from('fixtures')
    .select('*, league:leagues!fixtures_league_id_fkey(*)')
    .eq('id', 7440)
    .single();

  console.log('Fixture ID 7440 details:');
  console.log('Season in fixture:', fixture.season);
  console.log('League season in fixture:', fixture.league?.season);
}
run();
