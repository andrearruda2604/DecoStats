import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) { let v = match[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); env[match[1].trim()] = v; }
  });
} catch(e) {}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const {data: rm} = await sb.from('teams_history').select('team_id, season, league_id, is_home').eq('team_id', 541).limit(10);
console.log('RM teams_history (team_id=541):', JSON.stringify(rm));

const {data: oviedo} = await sb.from('teams').select('id, api_id, name').ilike('name', '%viedo%');
console.log('Oviedo in teams:', JSON.stringify(oviedo));

const {data: league140} = await sb.from('leagues').select('id, api_id, name').eq('id', 140);
console.log('League db_id=140:', JSON.stringify(league140));

const {data: leagueApi140} = await sb.from('leagues').select('id, api_id, name').eq('api_id', 140);
console.log('League api_id=140:', JSON.stringify(leagueApi140));

// Check Oviedo in teams_history
const {data: ovHist} = await sb.from('teams_history').select('team_id, season, league_id, is_home').eq('team_id', 718).limit(20);
console.log('Oviedo teams_history:', JSON.stringify(ovHist));

// RM away count in La Liga season 2025
const {data: rmHome} = await sb.from('teams_history').select('team_id, season, league_id, is_home').eq('team_id', 541).eq('season', 2025).eq('league_id', 140).eq('is_home', true);
console.log(`RM home in La Liga 2025: ${rmHome?.length} records`);

// Check the fixture
const {data: fix} = await sb.from('fixtures').select('api_id, date, season, league_id, league:leagues!fixtures_league_id_fkey(id, api_id, name)').eq('api_id', 1391176).maybeSingle();
console.log('Fixture 1391176:', JSON.stringify(fix));
