import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const API_KEY = process.env.VITE_API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncDate(dateStr) {
  console.log(`Syncing results for ${dateStr}...`);
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
    headers: { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
  });
  const json = await resp.json();
  const matches = json.response || [];
  
  for (const m of matches) {
    if (m.fixture.status.short === 'FT') {
      await supabase.from('fixtures').update({
        status: 'FT',
        home_score: m.goals.home,
        away_score: m.goals.away,
        ht_home_score: m.score.halftime.home,
        ht_away_score: m.score.halftime.away
      }).eq('api_id', m.fixture.api_id || m.fixture.id);
    }
  }
}

async function run() {
  await syncDate('2026-04-25');
  await syncDate('2026-04-26');
  await syncDate('2026-04-27');
  console.log('Done syncing results.');
}

run().catch(console.error);
