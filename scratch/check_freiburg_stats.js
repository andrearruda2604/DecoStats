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
  const { data: freiburgHistory, error } = await supabase.from('teams_history')
    .select('fixture_id, league_id, is_home, corners, shots_on_goal, shots_total, offsides, stats_ft')
    .eq('team_id', 160)
    .limit(20);
  
  if (error) console.error(error);
  else {
    console.log('Freiburg total entries:', freiburgHistory.length);
    if (freiburgHistory.length > 0) {
      console.log('Sample entry:', freiburgHistory[0]);
      const leagues = [...new Set(freiburgHistory.map(h => h.league_id))];
      console.log('Leagues Freiburg played in:', leagues);
    }
  }

  console.log('\n--- Aston Villa (66) ---');
  const { data: astonHistory, error2 } = await supabase.from('teams_history')
    .select('fixture_id, league_id, is_home, corners, shots_on_goal, shots_total, offsides, stats_ft')
    .eq('team_id', 66)
    .limit(20);
    
  if (error2) console.error(error2);
  else {
    console.log('Aston Villa total entries:', astonHistory.length);
    if (astonHistory.length > 0) {
      console.log('Sample entry:', astonHistory[0]);
      const leagues = [...new Set(astonHistory.map(h => h.league_id))];
      console.log('Leagues Aston Villa played in:', leagues);
    }
  }
}
run();
