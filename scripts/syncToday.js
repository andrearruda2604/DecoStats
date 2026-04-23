import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis no ambiente local, se rodando offline
let env = process.env;
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
} catch (e) {
  // Ignora se não existir arquivo .env local (ex: rodando via GitHub Actions)
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const API_KEY = process.env.VITE_API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY || env.API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LEAGUES_TO_SYNC = [39, 140, 135, 78, 61, 94, 71, 2];

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function fetchWithRetry(url) {
  let retries = 3;
  while (retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
      return data;
    } catch (err) {
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if (retries === 0) throw err;
    }
  }
}

async function syncToday() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`=== Sincronizando Jogos de Hoje (${today}) ===\n`);

  // Busca apenas os jogos do dia na API
  const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${today}`);
  const matches = (data.response || []).filter(m => LEAGUES_TO_SYNC.includes(m.league.id));

  console.log(`Encontrados ${matches.length} jogos monitorados hoje.\n`);

  for (const m of matches) {
    const apiId = m.fixture.id;
    const status = m.fixture.status.short;
    
    // Status que significam placar ao vivo/final aberto (em andamento ou finalizado)
    const activeOrFinishedStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'FT', 'AET', 'PEN'];

    if (!activeOrFinishedStatuses.includes(status)) {
      console.log(`- ${m.teams.home.name} x ${m.teams.away.name} ainda não começou (${status}). Ignorando placar.`);
      continue;
    }

    // 1. Atualizar Placar no Supabase
    const updateData = {
      status: status,
      home_score: m.goals.home || 0,
      away_score: m.goals.away || 0,
      ht_home_score: m.score?.halftime?.home ?? null,
      ht_away_score: m.score?.halftime?.away ?? null
    };

    const { error: fixError } = await supabase.from('fixtures').update(updateData).eq('api_id', apiId);

    if (fixError) {
      console.error(`Erro atualizando jogo ${apiId}:`, fixError.message);
    } else {
      console.log(`✓ Atualizado: [${status}] ${m.teams.home.name} ${updateData.home_score}-${updateData.away_score} ${m.teams.away.name}`);
    }

    // Opcional: Para evitar gasto de créditos pesados (API consumindo muita query de estatísticas),
    // apenas processamos "estatísticas finais" se o status for FT/AET/PEN
    // (aí rodaria a lógica parecida com a que está no updateResults.js para popular a tabela teams_history).
  }

  console.log(`\n=== Sincronização concluída ===`);
}

syncToday().catch(console.error);
