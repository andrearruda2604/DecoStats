import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Get ALL tickets with entries
const { data: tickets } = await supabase
  .from('odd_tickets')
  .select('date, mode, ticket_data')
  .gt('matches_count', 0);

if (!tickets || tickets.length === 0) {
  console.log('No non-empty tickets found.');
  process.exit(0);
}

// Build logo lookup from teams table (api_id -> logo_url)
const { data: teamsData } = await supabase.from('teams').select('api_id, logo_url');
const teamLogoMap = {};
for (const t of (teamsData || [])) {
  teamLogoMap[t.api_id] = t.logo_url;
}

// Build league logo lookup
const { data: leaguesData } = await supabase.from('leagues').select('api_id, logo_url');
const leagueLogoMap = {};
for (const l of (leaguesData || [])) {
  leagueLogoMap[l.api_id] = l.logo_url;
}

let updatedCount = 0;
for (const ticket of tickets) {
  const entries = ticket.ticket_data?.entries || [];
  let changed = false;

  for (const entry of entries) {
    // Update league logo if it's api-sports
    if (entry.league_logo_url && entry.league_logo_url.includes('api-sports')) {
      // Try to find matching league api_id from URL
      const match = entry.league_logo_url.match(/leagues\/(\d+)/);
      if (match) {
        const newLogo = leagueLogoMap[parseInt(match[1])];
        if (newLogo && !newLogo.includes('api-sports')) {
          entry.league_logo_url = newLogo;
          changed = true;
        }
      }
    }

    // Update home/away logos if they're api-sports
    for (const key of ['homeLogo', 'awayLogo']) {
      if (entry[key] && entry[key].includes('api-sports')) {
        const match = entry[key].match(/teams\/(\d+)/);
        if (match) {
          const newLogo = teamLogoMap[parseInt(match[1])];
          if (newLogo && !newLogo.includes('api-sports')) {
            entry[key] = newLogo;
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    const { error } = await supabase
      .from('odd_tickets')
      .update({ ticket_data: ticket.ticket_data })
      .eq('date', ticket.date)
      .eq('mode', ticket.mode);
    
    if (error) {
      console.error(`Error updating ${ticket.date} ${ticket.mode}:`, error.message);
    } else {
      updatedCount++;
      console.log(`Updated ${ticket.date} (${ticket.mode})`);
    }
  }
}

console.log(`\n✅ Updated ${updatedCount} tickets with new logo URLs.`);
