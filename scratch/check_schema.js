import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=\"(.*?)\"/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const { data: tickets } = await supabase.from('odd_tickets').select('id, ticket_data').limit(1);
  if (tickets && tickets.length > 0) {
    console.log('Ticket keys:', Object.keys(tickets[0].ticket_data));
    console.log('Ticket entry logos:', tickets[0].ticket_data.entries[0]?.homeLogo, tickets[0].ticket_data.entries[0]?.awayLogo);
  }

  const { data: opps } = await supabase.from('opportunities').select('*').limit(1);
  if (opps && opps.length > 0) {
    console.log('Opp keys:', Object.keys(opps[0]));
  }
}
check();
