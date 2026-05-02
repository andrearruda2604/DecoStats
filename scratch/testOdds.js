import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^\"|\"$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('fixtures').select('api_id, odds').not('odds', 'is', null).limit(10);
  for (const d of data) {
    if (d && d.odds) {
      const bets = d.odds.filter(b => [45, 57, 58, 80].includes(b.id));
      if (bets.length > 0) {
         console.log('Match API ID:', d.api_id);
         console.log(JSON.stringify(bets, null, 2));
      }
    }
  }
}
run();
