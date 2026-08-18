import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function run() {
  const { data } = await supabase.from('odd_tickets').select('ticket_data').eq('date', '2026-07-25').eq('mode', 'opp').single();
  if (data && data.ticket_data.opportunities) {
    console.log(`Found ${data.ticket_data.opportunities.length} opportunities for 2026-07-25.`);
    
    // Check some dates
    const fixIds = [...new Set(data.ticket_data.opportunities.map(o => o.fixture_id))];
    const { data: fixes } = await supabase.from('fixtures').select('api_id, date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)').in('api_id', fixIds);
    
    console.log(fixes.map(f => f.home_team.name + ' x ' + f.away_team.name + ' (' + f.date + ')'));
  } else {
    console.log('No ticket_data found for 2026-07-25 in odd_tickets.');
  }
}
run();
