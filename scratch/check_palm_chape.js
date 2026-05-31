import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: fixtures } = await supabase.from('fixtures').select('api_id, date, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)').ilike('home_team.name', '%palmeiras%').ilike('away_team.name', '%chapecoense%').order('date', {ascending: false}).limit(5);
  console.log(fixtures);
}
check();
