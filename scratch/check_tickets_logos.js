import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: tickets, error } = await supabase.from('odd_tickets').select('date, mode, ticket_data');
  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }
  let found = false;
  for (const t of (tickets || [])) {
    const jsonStr = JSON.stringify(t.ticket_data);
    if (jsonStr.includes('media.api-sports.io') || jsonStr.includes('media-4.api-sports.io') || jsonStr.includes('api-sports')) {
      console.log(`Ticket ${t.date} (${t.mode}) still contains api-sports URLs!`);
      found = true;
      
      // Fix it inline to be helpful
      const newJsonStr = jsonStr.replace(/https:\/\/media(-\d+)?\.api-sports\.io[^\"]*/g, (match) => {
          // It's tricky to map it without knowing the id, but we can just use the script again. 
          return match;
      });
    }
  }
  if (!found) console.log('No api-sports URLs found in tickets.');
}
check();
