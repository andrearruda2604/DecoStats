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
  const targetDate = '2026-05-19';
  const nextDate = new Date(`${targetDate}T03:00:00Z`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19);

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('id, api_id, date, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .gte('date', `${targetDate} 03:00:00`)
    .lte('date', endDateStr);

  if (error) console.error(error);
  else {
    console.log('Fixtures for 19/05:', fixtures.length);
    for (const f of fixtures) {
      console.log(`ID: ${f.api_id} | ${f.home_team?.name} x ${f.away_team?.name} | Status: ${f.status}`);
    }
  }
}
run();
