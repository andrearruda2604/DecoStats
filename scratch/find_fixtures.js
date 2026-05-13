
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: fixtures } = await supabase.from('fixtures')
    .select(`
      api_id, 
      date,
      home_team:teams!fixtures_home_team_id_fkey(name, logo_url), 
      away_team:teams!fixtures_away_team_id_fkey(name, logo_url)
    `)
    .gte('date', '2026-05-13T00:00:00')
    .lte('date', '2026-05-13T23:59:59');

  fixtures.forEach(f => {
    console.log(`ID: ${f.api_id} | ${f.home_team.name} x ${f.away_team.name} | ${f.date}`);
  });
}

check();
