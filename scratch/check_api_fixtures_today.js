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

async function fetchApi(url) {
  for (let i = 3; i > 0; i--) {
    try {
      const r = await fetch(url, { headers: API_HEADERS });
      const d = await r.json();
      if (d.errors && Object.keys(d.errors).length) throw new Error(JSON.stringify(d.errors));
      return d.response || [];
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function check() {
  console.log('--- Buscando todos os jogos da Serie B direto na API para hoje e amanhã (UTC) ---');
  // Busca pela Serie B do Brasil (League ID 72 no API-Football) para a temporada 2026
  const resp = await fetchApi(`https://v3.football.api-sports.io/fixtures?league=72&season=2026`);
  
  if (!resp || resp.length === 0) {
      console.log('Nenhum jogo retornado pela API.');
      return;
  }
  
  // Filtrar jogos próximos à data de hoje (02/07/2026 ou 03/07/2026 em UTC)
  const jogosHoje = resp.filter(f => f.fixture.date.includes('2026-07-02') || f.fixture.date.includes('2026-07-03'));
  
  console.log(`Foram encontrados ${jogosHoje.length} jogos próximos na Serie B (API).\n`);
  
  jogosHoje.forEach(f => {
      console.log(`ID do Jogo na API: ${f.fixture.id}`);
      console.log(`Data/Hora (UTC): ${f.fixture.date}`);
      console.log(`Status: ${f.fixture.status.long} (${f.fixture.status.short})`);
      console.log(`Confronto: ${f.teams.home.name} x ${f.teams.away.name}`);
      console.log('--------------------------------------------------');
  });
}

check().catch(console.error);
