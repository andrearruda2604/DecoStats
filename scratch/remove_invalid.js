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
  const dates = ['2026-05-19', '2026-05-20'];
  const { data, error } = await supabase.from('odd_tickets').select('date, mode, ticket_data').in('date', dates).eq('mode', 'opp');
  if (error) {
    console.error(error);
    return;
  }
  
  for (const d of data) {
    const opps = d.ticket_data.opportunities || [];
    const validOpps = opps.filter(o => o.histTotal >= 7);
    
    console.log(`Date: ${d.date} | Total before: ${opps.length} | Total after: ${validOpps.length}`);
    
    if (validOpps.length !== opps.length) {
      const updatedTicketData = { ...d.ticket_data, opportunities: validOpps };
      const { error: updateError } = await supabase
        .from('odd_tickets')
        .update({ ticket_data: updatedTicketData })
        .eq('date', d.date)
        .eq('mode', 'opp');
        
      if (updateError) {
        console.error(`Error updating ${d.date}:`, updateError);
      } else {
        console.log(`Successfully updated ${d.date}`);
      }
    }
  }
}
run();
