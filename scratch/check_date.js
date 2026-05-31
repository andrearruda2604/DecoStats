import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

supabase.from('odd_tickets').select('ticket_data').eq('date','2026-05-31').eq('mode','opp').single().then(r => {
  const opps = r.data.ticket_data.opportunities;
  console.log(opps.slice(0,5).map(o=>`${o.home} - ${o.date_time}`));
});
