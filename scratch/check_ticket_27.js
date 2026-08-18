import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

async function check() {
  const date = process.argv[2] || '2026-06-27';
  
  const { data: tickets } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('date', date)
    .in('mode', ['2.0', '3.0']);

  for (const t of tickets) {
    console.log(`\n=== Bilhete ${t.mode} — ${t.date} — status: ${t.status} ===`);
    const entries = t.ticket_data?.entries || [];
    for (const e of entries) {
      console.log(`\n  ${e.home} x ${e.away} (fixture_id: ${e.fixture_id}) — result: ${e.result}`);
      for (const p of e.picks) {
        console.log(`    [${p.result}] stat=${p.stat} period=${p.period} teamTarget=${p.teamTarget} type=${p.type} threshold=${p.threshold} line="${p.line}" actualValue=${p.actualValue} odd=${p.odd}`);
      }
    }
  }
}

check().catch(console.error);
