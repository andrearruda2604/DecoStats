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

const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function fetchApi(url) {
  try {
    const r = await fetch(url, { headers: API_HEADERS });
    const d = await r.json();
    return d.response || [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function findAllBets() {
  console.log(`Fetching all available bets from API...`);
  const bets = await fetchApi(`https://v3.football.api-sports.io/odds/bets`);
  
  const mapped = [];
  for (const b of bets || []) {
    if (b && b.name) {
      mapped.push(`ID: ${b.id} | Name: ${b.name}`);
    }
  }
  
  fs.writeFileSync('scratch/all_api_bets.txt', mapped.join('\n'));
  console.log(`Saved ${mapped.length} bets to scratch/all_api_bets.txt`);
}

findAllBets();
