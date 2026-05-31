import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function fixTickets() {
  const { data: tickets, error } = await supabase.from('odd_tickets').select('date, mode, ticket_data');
  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }
  
  for (const t of (tickets || [])) {
    const originalJsonStr = JSON.stringify(t.ticket_data);
    let newJsonStr = originalJsonStr.replace(/https:\/\/media(?:-\d+)?\.api-sports\.io\/football\/(teams|leagues)\/(\d+)\.png/g, `${url}/storage/v1/object/public/logos/$1/$2.png`);
    
    if (newJsonStr !== originalJsonStr) {
      console.log(`Fixing logos for ticket ${t.date} (${t.mode})...`);
      const { error: updErr } = await supabase.from('odd_tickets')
        .update({ ticket_data: JSON.parse(newJsonStr) })
        .eq('date', t.date)
        .eq('mode', t.mode);
      if (updErr) console.error('Error updating:', updErr);
      else console.log('Fixed!');
    }
  }
  console.log('All tickets checked and fixed.');
}
fixTickets();
