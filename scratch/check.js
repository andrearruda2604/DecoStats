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
  const { data, error } = await supabase.from('odd_tickets').select('date, mode, ticket_data').in('date', ['2026-05-19', '2026-05-20']).eq('mode', 'opp');
  if (error) console.error(error);
  else {
    for (const d of data) {
      const opps = d.ticket_data.opportunities || [];
      const invalid = opps.filter(o => o.histTotal < 7);
      console.log('Date:', d.date, 'Total:', opps.length, 'Invalid (histTotal < 7):', invalid.length);
      
      if (invalid.length > 0) {
        console.log('Example invalid:', invalid.slice(0, 3).map(o => o.histTotal + ' ' + o.home + ' x ' + o.away));
      }
    }
  }
}
run();
