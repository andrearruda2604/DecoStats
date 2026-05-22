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
  const { data: leagues } = await supabase.from('leagues').select('id, name, season');
  console.log('--- LEAGUES ---');
  for (const l of leagues || []) {
    console.log(`League: ${l.name} (ID: ${l.id}) | Season in DB: ${l.season}`);
  }

  const { data: historySeasons } = await supabase.rpc('execute_sql', {
    query: 'select league_id, season, count(*) from teams_history group by league_id, season order by count(*) desc limit 20;'
  });
  if (historySeasons) {
    console.log('--- TEAMS HISTORY SEASONS ---');
    console.log(historySeasons);
  } else {
    // Fallback if RPC execute_sql is not available
    const { data: hist } = await supabase.from('teams_history').select('league_id, season').limit(100);
    const counts = {};
    for (const h of hist || []) {
      const key = `${h.league_id}-${h.season}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    console.log('--- TEAMS HISTORY SEASONS (Sample) ---', counts);
  }
}
run();
