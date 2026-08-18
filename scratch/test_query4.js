import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkDate() {
  const today = '2026-06-15';
  
  // Find EXACTLY the game Criciuma vs Ceara
  const { data: teamA } = await supabase.from('teams').select('id, name').ilike('name', '%Criciuma%');
  const { data: teamB } = await supabase.from('teams').select('id, name').ilike('name', '%Ceara%');
  
  console.log('Criciuma:', teamA);
  console.log('Ceara:', teamB);
  
  if (teamA?.length && teamB?.length) {
    const { data: fix } = await supabase.from('fixtures')
      .select('api_id, date, status, home_team_id, away_team_id')
      .eq('home_team_id', teamA[0].id)
      .eq('away_team_id', teamB[0].id);
    console.log('Fixture Criciuma vs Ceara:', fix);
  }

  // Look for any games on 2026-06-15 and 2026-06-16
  const { data: fixDays } = await supabase.from('fixtures')
    .select('api_id, date, status, home_team:home_team_id(name), away_team:away_team_id(name)')
    .gte('date', '2026-06-15T00:00:00Z')
    .lte('date', '2026-06-17T00:00:00Z');
  
  console.log('Fixtures between 15th and 17th:', fixDays);
}

checkDate();
