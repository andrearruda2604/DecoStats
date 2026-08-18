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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY };

async function check() {
  const { data: tickets } = await supabase.from('odd_tickets').select('*').eq('date', '2026-06-15');
  const fixtureIds = [];
  
  for (const t of tickets) {
    for (const e of (t.ticket_data?.entries || [])) {
      if (!fixtureIds.includes(e.fixture_id)) fixtureIds.push(e.fixture_id);
    }
  }
  
  console.log(`Fixtures to check for 15/06: ${fixtureIds.join(', ')}`);
  
  // 1. Check DB fixtures
  const { data: dbFix } = await supabase.from('fixtures').select('api_id, status, home_score, away_score').in('api_id', fixtureIds);
  console.log('\n=== DB Fixtures ===');
  console.log(dbFix);
  
  // 2. Fetch from API
  for (const fid of fixtureIds) {
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fid}`, { headers });
    const data = await resp.json();
    const fix = data.response?.[0];
    if (fix) {
      console.log(`\n=== API Fixture ${fid} ===`);
      console.log(`Status: ${fix.fixture.status.short}`);
      console.log(`Goals: ${fix.goals.home} - ${fix.goals.away}`);
    } else {
      console.log(`\n=== API Fixture ${fid} NOT FOUND ===`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

check().catch(console.error);
