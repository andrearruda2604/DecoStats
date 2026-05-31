import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: teams } = await supabase.from('teams').select('id, logo_url').like('logo_url', '%api-sports%');
  const { data: leagues } = await supabase.from('leagues').select('id, logo_url').like('logo_url', '%api-sports%');
  
  console.log(`${teams?.length || 0} teams still use api-sports`);
  console.log(`${leagues?.length || 0} leagues still use api-sports`);
  
  if (teams && teams.length > 0) {
    console.log(teams.slice(0, 5));
  }
}
check();
