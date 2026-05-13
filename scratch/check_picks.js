
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: ticket } = await supabase.from('odd_tickets')
    .select('ticket_data')
    .eq('date', '2026-05-12')
    .eq('mode', '2.0')
    .single();

  const entry = ticket.ticket_data.entries.find(e => e.fixture_id === 1544850);
  console.log(JSON.stringify(entry.picks, null, 2));
}

check();
