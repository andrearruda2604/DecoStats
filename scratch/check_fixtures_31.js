import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local','utf8');
const [,url] = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const [,key] = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabase = createClient(url,key);

async function check() {
  const { data: fixtures } = await supabase.from('fixtures').select('api_id, date, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)').gte('date', '2026-05-30T00:00:00Z').lte('date', '2026-05-31T23:59:59Z');
  console.log(fixtures);
}
check();
