import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([^=]+)=(.*)$/);
  if (m) {
    let v = m[2].trim();
    if (v.startsWith('"')) v = v.slice(1, -1);
    env[m[1].trim()] = v;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('odd_tickets').select('created_at, ticket_data').eq('date', '2026-07-25').eq('mode', 'opp').single();
  if (data) {
    console.log('Created at:', data.created_at);
    console.log('Generated at:', data.ticket_data.generated_at);
  } else {
    console.log('Not found');
  }
}
run();
