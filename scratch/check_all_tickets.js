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
  const { data, error } = await supabase.from('odd_tickets').select('*').eq('date', '2026-05-19');
  if (error) console.error(error);
  else {
    console.log('Total tickets for 19/05:', data.length);
    for (const d of data) {
      console.log('Mode:', d.mode, 'Matches Count:', d.matches_count, 'Opps Length:', d.ticket_data?.opportunities?.length);
    }
  }
}
run();
