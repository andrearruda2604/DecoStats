import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function run() {
  const { data, error } = await supabase.from('odd_tickets').select('ticket_data').eq('date', '2026-05-19').eq('mode', 'opp').maybeSingle();
  if (error) console.error(error);
  else if (data) {
    const opps = data.ticket_data.opportunities || [];
    console.log('Opps found:', opps.length);
    for (const o of opps) {
      console.log(`Match: ${o.home} x ${o.away} | Market: ${o.market} | Line: ${o.line} | Prob: ${o.probability}% | Odd: ${o.odd} | HistTotal: ${o.histTotal}`);
    }
  } else {
    console.log('No ticket found for 19/05');
  }
}
run();
