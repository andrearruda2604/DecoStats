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

async function discover() {
  const headers = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };
  // Find a fixture ID for tomorrow
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const { data: fixtures } = await supabase.from('fixtures').select('api_id').gte('date', '2026-05-09').limit(5);
  
  if (!fixtures || fixtures.length === 0) {
    console.log("No fixtures found for tomorrow");
    return;
  }

  for (const f of fixtures) {
    console.log(`\nChecking markets for fixture ${f.api_id}...`);
    const r = await fetch(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}&bookmaker=8`, { headers });
    const d = await r.json();
    const bets = d.response?.[0]?.bookmakers?.[0]?.bets;
    if (bets) {
      bets.forEach(b => {
        console.log(`ID: ${b.id} | Name: ${b.name}`);
      });
      break;
    }
  }
}

discover().catch(console.error);
