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

async function run() {
  console.log('--- SC Freiburg (160) ---');
  const { data: homeHistory } = await supabase.from('teams_history')
    .select('fixture_id, match_date, season, goals_for, goals_against, is_home')
    .eq('team_id', 160)
    .eq('league_id', 92)
    .order('match_date', { ascending: false });

  for (const h of homeHistory || []) {
    console.log(`Fix: ${h.fixture_id} | Date: ${h.match_date} | Season: ${h.season} | Home?: ${h.is_home} | ${h.goals_for}-${h.goals_against}`);
  }

  console.log('--- Aston Villa (66) ---');
  const { data: awayHistory } = await supabase.from('teams_history')
    .select('fixture_id, match_date, season, goals_for, goals_against, is_home')
    .eq('team_id', 66)
    .eq('league_id', 92)
    .order('match_date', { ascending: false });

  for (const h of awayHistory || []) {
    console.log(`Fix: ${h.fixture_id} | Date: ${h.match_date} | Season: ${h.season} | Home?: ${h.is_home} | ${h.goals_for}-${h.goals_against}`);
  }
}
run();
