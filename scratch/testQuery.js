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

async function test() {
  const f = {
    home_team: { api_id: 135 },
    away_team: { api_id: 1062 },
    season: 2026,
    league: { api_id: 71 }
  };
  
  const { data: homeHistory } = await supabase.from('teams_history')
    .select('*').eq('team_id', f.home_team.api_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', true);
    
  console.log("HOME HISTORY COUNT:", homeHistory?.length || 0);
  console.log("SAMPLE:", homeHistory?.[0]);
}

test();
