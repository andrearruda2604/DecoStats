import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function run() {
  const targetDate = '2026-07-25';
  const nextDate = new Date(`${targetDate}T03:00:00Z`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19); 

  let query = supabase
    .from('fixtures')
    .select('id, api_id, date, status, season, league_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name, logo_url), away_team:teams!fixtures_away_team_id_fkey(api_id, name, logo_url), league:leagues!fixtures_league_id_fkey(api_id, name, logo_url)')
    .gte('date', `${targetDate} 03:00:00`)
    .lte('date', endDateStr);

  const { data: fixtures } = await query;
  
  const { data: leagues } = await supabase.from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));
  const activeFix = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  
  console.log(`Querying between ${targetDate} 03:00:00 and ${endDateStr}`);
  console.log(`Active fixtures found: ${activeFix.length}`);
  
  activeFix.forEach(f => {
    console.log(`${f.home_team?.name} x ${f.away_team?.name} (${f.date})`);
  });
}
run();
