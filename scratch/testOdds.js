import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
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

const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function test() {
  const fixtureId = 1378202; // Inter x Torino
  const url = `https://v3.football.api-sports.io/odds?fixture=${fixtureId}&bookmaker=8`;
  const r = await fetch(url, { headers: API_HEADERS });
  const d = await r.json();
  console.log(JSON.stringify(d, null, 2));
}

test().catch(console.error);
