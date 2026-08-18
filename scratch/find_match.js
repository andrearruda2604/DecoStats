import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function findMatch() {
  const { data: fixtures } = await supabase.from('fixtures')
    .select('id, api_id, date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .ilike('away_team.name', '%Ceara%')
    .ilike('home_team.name', '%America%')
    .order('date', { ascending: false })
    .limit(10);
    
  console.log("Fixtures (America x Ceara):");
  for (const f of fixtures || []) {
    // Supabase ilike on related tables returns the parent row with null related object if it doesn't match
    if (f.home_team && f.away_team) {
      console.log(`ID: ${f.id} | API_ID: ${f.api_id} | Date: ${f.date} | ${f.home_team?.name} x ${f.away_team?.name}`);
    }
  }
}

findMatch();
