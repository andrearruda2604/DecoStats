import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);

const supabaseUrl = urlMatch[1];
const supabaseKey = keyMatch[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogos() {
  const { data: teams, error } = await supabase.from('teams').select('id, name, logo_url');
  if (error) {
    console.error('Error fetching teams:', error);
    return;
  }

  const nullLogo = teams.filter(t => !t.logo_url);
  const apiSportsLogo = teams.filter(t => t.logo_url && t.logo_url.includes('api-sports'));
  const supabaseLogo = teams.filter(t => t.logo_url && t.logo_url.includes('supabase'));

  console.log(`Total teams: ${teams.length}`);
  console.log(`Null logos: ${nullLogo.length}`);
  console.log(`API-Sports logos: ${apiSportsLogo.length}`);
  console.log(`Supabase logos: ${supabaseLogo.length}`);
}

checkLogos().catch(console.error);
