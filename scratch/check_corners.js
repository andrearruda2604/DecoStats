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
  const fid = 1520749; // Operario-PR x America Mineiro

  // 1. Check DB teams_history
  const { data: th } = await supabase.from('teams_history')
    .select('id, team_id, is_home, corners, stats_ft, stats_1h')
    .eq('fixture_id', fid);
  
  console.log('=== teams_history no banco ===');
  for (const r of (th || [])) {
    const cornersFromStats = r.stats_ft?.find(s => s.type === 'Corner Kicks');
    console.log(`  team_id=${r.team_id} is_home=${r.is_home} corners=${r.corners} stats_ft_corners=${cornersFromStats?.value || 'N/A'}`);
    
    const corners1h = r.stats_1h?.find(s => s.type === 'Corner Kicks');
    console.log(`    stats_1h_corners=${corners1h?.value || 'N/A'}`);
  }

  // 2. Check API - fixture events (corners are events)
  console.log('\n=== API: Events (corners) ===');
  const evResp = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fid}&type=Corner`, { headers });
  const evData = await evResp.json();
  const events = evData.response || [];
  console.log(`  Total corner events: ${events.length}`);
  
  const cornersByTeam = {};
  for (const ev of events) {
    const name = ev.team.name;
    cornersByTeam[name] = (cornersByTeam[name] || 0) + 1;
  }
  console.log('  Corners by team:', cornersByTeam);

  // 3. Check API statistics (fresh)
  console.log('\n=== API: Statistics (fresh) ===');
  const statsResp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}`, { headers });
  const statsData = await statsResp.json();
  for (const team of (statsData.response || [])) {
    const corners = (team.statistics || []).find(s => s.type === 'Corner Kicks');
    console.log(`  ${team.team.name}: Corners = ${corners?.value}`);
  }
}

check().catch(console.error);
