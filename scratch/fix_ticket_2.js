
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

async function fix() {
  const { data: ticket } = await supabase.from('odd_tickets')
    .select('*')
    .eq('date', '2026-05-12')
    .eq('mode', '2.0')
    .single();

  if (!ticket) {
    console.log('Ticket not found');
    return;
  }

  const entries = ticket.ticket_data.entries;
  const entry = entries.find(e => e.fixture_id === 1544850);
  
  if (entry) {
    const pick = entry.picks[0]; // Assuming only one pick for this game
    pick.period = 'FT';
    pick.market = pick.market.replace('1T', 'FT');
    pick.result = 'WON';
    pick.actualValue = 2; // Based on my manual check
    
    entry.matchResult = 'WON';
    entry.result = 'WON';
  }

  const updatedTicketData = {
    ...ticket.ticket_data,
    entries: entries
  };

  const { error } = await supabase.from('odd_tickets')
    .update({
      status: 'WON',
      ticket_data: updatedTicketData
    })
    .eq('date', '2026-05-12')
    .eq('mode', '2.0');

  if (error) {
    console.error('Error updating ticket:', error);
  } else {
    console.log('Ticket 2.0 updated successfully to WON (HT -> FT)');
  }
}

fix();
