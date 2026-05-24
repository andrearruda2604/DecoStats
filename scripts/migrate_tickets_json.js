import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=\"(.*?)\"/);
const supabaseUrl = urlMatch[1];
const supabase = createClient(supabaseUrl, keyMatch[1]);

async function migrateTickets() {
  const { data: tickets, error: fetchErr } = await supabase.from('odd_tickets').select('date, mode, ticket_data');
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  
  let updatedCount = 0;
  for (const t of tickets) {
    let jsonStr = JSON.stringify(t.ticket_data);
    if (jsonStr.includes('https://media.api-sports.io/football/')) {
      const newJsonStr = jsonStr.replace(/https:\/\/media\.api-sports\.io\/football\//g, `${supabaseUrl}/storage/v1/object/public/logos/`);
      const newTicketData = JSON.parse(newJsonStr);
      
      const { error: upErr } = await supabase.from('odd_tickets').update({ ticket_data: newTicketData }).eq('date', t.date).eq('mode', t.mode);
      if (upErr) {
        console.error(`Failed to update ticket ${t.date} ${t.mode}:`, upErr);
      } else {
        console.log(`Updated ticket ${t.date} ${t.mode}`);
        updatedCount++;
      }
    }
  }
  console.log(`Migration complete. Updated ${updatedCount} tickets.`);
}

migrateTickets().catch(console.error);
