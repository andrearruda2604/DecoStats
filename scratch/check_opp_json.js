const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const { data } = await supabase.from('odd_tickets').select('ticket_data').eq('date', '2026-06-21').eq('mode', 'opp').single();
  console.log('Opp homeLogo:', data.ticket_data.opportunities[0].homeLogo);
}
check();
