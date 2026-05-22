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
  const { data: fixtures, error } = await supabase.from('fixtures')
    .select('id, api_id, date, home_team_id, away_team_id, league_id, status, home_score, away_score')
    .or('home_team_id.eq.160,away_team_id.eq.160,home_team_id.eq.66,away_team_id.eq.66')
    .order('date', { ascending: false });

  if (error) console.error(error);
  else {
    console.log('Total fixtures for Freiburg/Aston Villa in DB:', fixtures.length);
    const elFixtures = fixtures.filter(f => f.league_id === 3 || f.league_id === 15 || f.league_id === 19); // let's see their leagues
    console.log('EL/other cups fixtures:');
    fixtures.slice(0, 10).forEach(f => {
      console.log(`Fix ID: ${f.id} | Date: ${f.date} | League: ${f.league_id} | Home: ${f.home_team_id} | Away: ${f.away_team_id} | Status: ${f.status} | Score: ${f.home_score}-${f.away_score}`);
    });
    const uniqueLeagues = [...new Set(fixtures.map(f => f.league_id))];
    console.log('Unique leagues in fixtures:', uniqueLeagues);
  }
}
run();
