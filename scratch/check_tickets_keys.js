import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: t2 } = await supabase.from('odd_tickets').select('ticket_data').eq('date','2026-05-31').eq('mode','2.0').single();
  console.log('2.0 keys:', Object.keys(t2?.ticket_data || {}));

  const { data: t3 } = await supabase.from('odd_tickets').select('ticket_data').eq('date','2026-05-31').eq('mode','3.0').single();
  console.log('3.0 keys:', Object.keys(t3?.ticket_data || {}));
}
check();
