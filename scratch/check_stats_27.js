import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY };

async function check() {
  // Verifica teams_history para pegar dados reais de corners
  const fixtureIds = [1520743, 1520749]; // Criciuma x São Bernardo, Operário x América
  
  for (const fid of fixtureIds) {
    console.log(`\n=== Fixture ${fid} ===`);
    
    // Check DB teams_history
    const { data: th } = await supabase.from('teams_history')
      .select('team_id, is_home, corners, shots_on_goal, shots_total, yellow_cards, goals_for, goals_against')
      .eq('fixture_id', fid);
    console.log('teams_history:', JSON.stringify(th, null, 2));
    
    // Check DB fixture
    const { data: fix } = await supabase.from('fixtures')
      .select('api_id, home_score, away_score, ht_home_score, ht_away_score, status')
      .eq('api_id', fid).single();
    console.log('fixture:', JSON.stringify(fix, null, 2));
    
    // Check API stats
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`, { headers });
    const data = await resp.json();
    for (const team of (data.response || [])) {
      console.log(`\nTeam: ${team.team.name} (id: ${team.team.id})`);
      const corners = (team.statistics || []).find(s => s.type === 'Corner Kicks');
      const cornersHT = (team.statistics_1h || []).find(s => s.type === 'Corner Kicks');
      const corners2H = (team.statistics_2h || []).find(s => s.type === 'Corner Kicks');
      console.log(`  Corners FT: ${corners?.value}, HT: ${cornersHT?.value}, 2H: ${corners2H?.value}`);
      
      const yellows = (team.statistics || []).find(s => s.type === 'Yellow Cards');
      console.log(`  Yellow Cards FT: ${yellows?.value}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

check().catch(console.error);
