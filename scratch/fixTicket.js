import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixTicket() {
  const targetDate = '2026-04-29';
  console.log(`Fixing ticket for ${targetDate}`);

  const { data: ticket, error } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('date', targetDate)
    .maybeSingle();

  if (!ticket || error) {
    console.error('Ticket not found or error:', error);
    return;
  }

  const entries = ticket.ticket_data.entries || [];
  
  // Extract all fixture IDs
  const fixtureIds = entries.map(e => e.fixture_id);
  
  if (fixtureIds.length === 0) {
    console.log('No entries to fix.');
    return;
  }

  // Get teams logo from fixtures table
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('api_id, home_team:teams!fixtures_home_team_id_fkey(logo_url), away_team:teams!fixtures_away_team_id_fkey(logo_url)')
    .in('api_id', fixtureIds);

  const logoMap = {};
  fixtures?.forEach(f => {
    logoMap[f.api_id] = {
      homeLogo: f.home_team?.logo_url || '',
      awayLogo: f.away_team?.logo_url || ''
    };
  });

  const updatedEntries = entries.map(e => {
    const logos = logoMap[e.fixture_id] || { homeLogo: '', awayLogo: '' };
    return { ...e, homeLogo: logos.homeLogo, awayLogo: logos.awayLogo };
  });

  ticket.ticket_data.entries = updatedEntries;

  await supabase.from('odd_tickets').update({
    status: 'PENDING',
    ticket_data: ticket.ticket_data
  }).eq('date', targetDate);

  console.log(`Ticket ${targetDate} updated: logos added and set to PENDING`);
}

fixTicket().catch(console.error);
