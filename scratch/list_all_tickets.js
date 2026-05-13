
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
  const { data: tickets } = await supabase.from('odd_tickets')
    .select('mode, status, ticket_data')
    .eq('date', '2026-05-12');

  tickets.forEach(t => {
    console.log(`Mode: ${t.mode}, Status: ${t.status}`);
    t.ticket_data.entries.forEach(e => {
      console.log(`  Entry: ${e.home} x ${e.away}`);
      e.picks.forEach(p => {
        console.log(`    Pick: ${p.team} ${p.stat} ${p.period} ${p.line}`);
      });
    });
  });
}

check();
