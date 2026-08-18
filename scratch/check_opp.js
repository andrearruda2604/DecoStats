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
  const { data } = await supabase.from('odd_tickets').select('date, ticket_data').eq('mode', 'opp').order('date', { ascending: false }).limit(2);
  console.log('Ultimos tickets opp no banco:', data.map(d => ({ date: d.date, oppCount: d.ticket_data?.opportunities?.length, firstOppDate: d.ticket_data?.opportunities?.[0]?.date_time })));
}
run();
