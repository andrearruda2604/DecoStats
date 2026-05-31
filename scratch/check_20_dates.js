import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: t31 } = await supabase.from('odd_tickets').select('ticket_data').eq('date','2026-05-31').eq('mode','2.0').single();
  
  if (t31?.ticket_data?.opportunities) {
    console.log('2026-05-31 2.0 ticket contains dates:');
    const dates = [...new Set(t31.ticket_data.opportunities.map(o => o.date_time.split('T')[0]))];
    console.log(dates);
  }
}
check();
