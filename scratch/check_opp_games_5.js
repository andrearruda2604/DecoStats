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
  const { data } = await supabase.from('odd_tickets').select('ticket_data').eq('date', '2026-07-05').eq('mode', 'opp').single();
  const opps = data?.ticket_data?.opportunities || [];
  const games = Array.from(new Set(opps.map(o => o.home + ' x ' + o.away + ' (' + o.date_time + ')')));
  console.log('Jogos no bilhete de 2026-07-05:');
  console.log(games.join('\n'));
}
run();
