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

async function checkSync() {
  const homeTeam = { id: 140, name: 'Criciuma', logo: 'https://media.api-sports.io/football/teams/140.png' };
  
  const { data: existingTeams } = await supabase
      .from('teams')
      .select('api_id, logo_url')
      .in('api_id', [homeTeam.id]);
      
  const existingHome = existingTeams?.find(t => t.api_id === homeTeam.id);
  
  const homeLogoUrl = (existingHome && existingHome.logo_url && !existingHome.logo_url.includes('api-sports'))
      ? existingHome.logo_url
      : homeTeam.logo;
      
  console.log('existingHome:', existingHome);
  console.log('homeLogoUrl will be:', homeLogoUrl);
}

checkSync();
