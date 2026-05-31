import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: teams } = await supabase.from('teams').select('id, logo_url').like('logo_url', '%media%api-sports%');
  console.log(teams.length, 'teams still use api-sports');
  const { data: leagues } = await supabase.from('leagues').select('id, logo_url').like('logo_url', '%media%api-sports%');
  console.log(leagues.length, 'leagues still use api-sports');

  // Let's also check if API-sports changed the domain to media-4.api-sports.io etc.
  const { data: teams2 } = await supabase.from('teams').select('id, logo_url').limit(5);
  console.log('Sample teams:', teams2);
}
check();
