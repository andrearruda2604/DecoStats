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
  console.log('--- REQUISIÇÃO 1: Buscando APENAS Bet365 ---');
  const res1 = await fetchRawApi(`https://v3.football.api-sports.io/odds?fixture=1520754&bookmaker=8`);
  console.log(`URL: ${res1.url}`);
  console.log('Response JSON:');
  console.log(JSON.stringify(res1.response, null, 2));
  
  console.log('\n--- REQUISIÇÃO 2: Buscando TODAS as casas de aposta para o jogo ---');
  const res2 = await fetchRawApi(`https://v3.football.api-sports.io/odds?fixture=1520754`);
  console.log(`URL: ${res2.url}`);
  console.log('Response JSON:');
  console.log(JSON.stringify(res2.response, null, 2));
}

check().catch(console.error);
