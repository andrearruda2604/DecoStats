
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
  const { data: teams } = await supabase.from('teams').select('api_id, name').ilike('name', '%Strasbourg%');
  if (!teams || teams.length === 0) { console.log('No team found'); return; }
  const teamId = teams[0].api_id;
  
  const { data: leagues } = await supabase.from('leagues').select('api_id, name').ilike('name', '%Ligue 1%');
  const leagueId = leagues[0].api_id;
  const season = 2025; // Assuming current season is 2025 or 2026

  console.log(`Checking ${teams[0].name} (ID: ${teamId}) in ${leagues[0].name} (ID: ${leagueId}), Season: ${season}`);

  const { data: history } = await supabase.from('teams_history')
    .select('fixture_id, is_home, stats_ft')
    .eq('team_id', teamId)
    .eq('is_home', false)
    .eq('league_id', leagueId)
    .eq('season', season)
    .order('fixture_id', { ascending: false });

  console.log(`Total away games in history: ${history?.length || 0}`);
  
  let hits = 0;
  let valid = 0;
  for (const h of (history || [])) {
    const yellow = h.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
    const red = h.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0;
    const total = parseInt(yellow) + parseInt(red);
    valid++;
    if (total > 1.5) hits++;
    console.log(`Fixture ${h.fixture_id}: ${total} cards (Yellow: ${yellow}, Red: ${red})`);
  }

  console.log(`\nResult: ${hits}/${valid} (${(hits/valid*100).toFixed(2)}%)`);
}

check();
