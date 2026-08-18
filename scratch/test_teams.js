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

async function checkTeams() {
  const homeTeamId = 140; // Criciuma api_id
  const awayTeamId = 129; // Ceara api_id
  const { data: existingTeams } = await supabase
      .from('teams')
      .select('api_id, logo_url')
      .in('api_id', [homeTeamId, awayTeamId]);
      
  console.log('Existing teams:', existingTeams);
}

checkTeams();
