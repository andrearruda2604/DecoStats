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
} catch (e) { }

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: ticket } = await supabase.from('odd_tickets')
    .select('*')
    .eq('date', '2026-07-16')
    .eq('mode', '2.0')
    .maybeSingle();

  if (!ticket) { console.log('No ticket found'); return; }

  const entries = ticket.ticket_data?.entries || [];
  
  for (const e of entries) {
    console.log('\n========================================');
    console.log(JSON.stringify(e, null, 2));
    console.log('========================================');
  }

  // Also show fixture score
  const vascoEntry = entries.find(e => JSON.stringify(e).toLowerCase().includes('vasco'));
  if (vascoEntry?.fixture_id) {
    const { data: fix } = await supabase.from('fixtures')
      .select('*')
      .eq('api_id', vascoEntry.fixture_id)
      .maybeSingle();
    console.log('\n=== VASCO FIXTURE ===');
    console.log('home_score:', fix?.home_score, 'away_score:', fix?.away_score, 'status:', fix?.status);
  }
}

main().catch(console.error);
