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

const FIXTURE_ID = 1520716;

async function run() {
  const { data: fix, error } = await supabase
    .from('fixtures')
    .select('odds')
    .eq('api_id', FIXTURE_ID)
    .single();

  if (error || !fix) {
    console.error('Error fetching fixture:', error);
    return;
  }

  const odds = fix.odds || [];
  console.log(`Total markets: ${odds.length}`);
  odds.forEach(b => {
    console.log(`Market ID: ${b.id} | Name: ${b.name}`);
    if (b.values && b.values.length <= 6) {
      b.values.forEach(v => {
        console.log(`  - ${v.value}: ${v.odd}`);
      });
    } else if (b.values) {
      console.log(`  - (${b.values.length} outcomes, e.g. ${b.values[0].value}: ${b.values[0].odd})`);
    }
  });
}

run().catch(console.error);
