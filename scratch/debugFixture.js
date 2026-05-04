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

async function debug() {
  const { data: fixtures } = await supabase.from('fixtures')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*), league:league_id(*)')
    .eq('date', '2026-05-03')
    .limit(1);
    
  console.log("FIXTURE SAMPLE:", JSON.stringify(fixtures[0], null, 2));
}

debug();
