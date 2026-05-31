import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

supabase.from('odd_tickets').select('date, mode, ticket_data').eq('date','2026-05-31').eq('mode','opp').single().then(r => {
  if (r.data) {
     console.log('Opp ticket for 2026-05-31 generated at:', r.data.ticket_data.generated_at);
     console.log('Matches:');
     r.data.ticket_data.opportunities.slice(0, 5).forEach(o => console.log(o.home, o.away, o.date_time));
  } else {
     console.log('No ticket');
  }
});
