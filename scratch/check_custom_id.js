import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function fetchRawApi(url) {
    const r = await fetch(url, { headers: API_HEADERS });
    const json = await r.json();
    return { url, response: json };
}

async function check() {
  const id = '16301873979';
  console.log(`\n--- Testando ID fornecido: ${id} ---\n`);

  const resFix = await fetchRawApi(`https://v3.football.api-sports.io/fixtures?id=${id}`);
  console.log(`URL: ${resFix.url}`);
  console.log('Response JSON (Fixtures):');
  console.log(JSON.stringify(resFix.response, null, 2));
  
  console.log('\n----------------------------------------\n');

  const resOdds = await fetchRawApi(`https://v3.football.api-sports.io/odds?fixture=${id}`);
  console.log(`URL: ${resOdds.url}`);
  console.log('Response JSON (Odds):');
  console.log(JSON.stringify(resOdds.response, null, 2));
}

check().catch(console.error);
