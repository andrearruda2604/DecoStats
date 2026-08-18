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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function findMarkets() {
  const { data: fixtures } = await supabase.from('fixtures')
    .select('api_id, date')
    .eq('status', 'FT')
    .order('date', { ascending: false })
    .limit(5);
    
  if (!fixtures || fixtures.length === 0) {
    console.log("No fixtures found.");
    return;
  }
  
  const betMap = new Map();
  
  for (const f of fixtures) {
    console.log(`Fetching odds for fixture ${f.api_id}...`);
    const odds = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}`);
    
    for (const r of odds || []) {
      for (const b of r.bookmakers || []) {
        for (const bet of b.bets || []) {
          betMap.set(bet.id, bet.name);
        }
      }
    }
  }
  
  const sortedBets = Array.from(betMap.entries()).sort((a, b) => a[0] - b[0]);
  
  console.log("\nSuspect Markets:");
  for (const [id, name] of sortedBets) {
    const lower = name.toLowerCase();
    if (
      lower.includes('shot') || 
      lower.includes('goal') || 
      lower.includes('1st') || 
      lower.includes('half') ||
      lower.includes('ht') ||
      lower.includes('chute')
    ) {
      console.log(`ID: ${id} | Name: ${name}`);
    }
  }
}

findMarkets();
