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

async function checkBets() {
  const { data: oddsData } = await supabase.from('odds').select('odds_data').not('odds_data', 'is', null).limit(20);
  
  const betMap = new Map();
  for (const row of oddsData || []) {
    const bookmakers = row.odds_data;
    for (const bookmaker of bookmakers) {
      for (const bet of bookmaker.bets || []) {
        betMap.set(bet.id, bet.name);
      }
    }
  }
  
  console.log("Available bet markets in recent odds:");
  const sortedBets = Array.from(betMap.entries()).sort((a, b) => a[0] - b[0]);
  for (const [id, name] of sortedBets) {
    console.log(`Bet ID: ${id} | Name: ${name}`);
  }
}

checkBets();
