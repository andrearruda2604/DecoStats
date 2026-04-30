import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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
} catch (e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const API_KEY = process.env.VITE_API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  // Usa data no horário de Brasília (UTC-3) para bater com a data local dos jogos na API
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = brt.toISOString().split('T')[0];
  console.log(`=== Sincronizando Jogos de Hoje (${today} BRT) ===\n`);

  // 1. Carrega ligas ativas do banco (source of truth)
  const { data: activeLeagues, error: leaguesErr } = await supabase
    .from('leagues')
    .select('id, api_id, name')
    .eq('is_active', true);

  if (leaguesErr) throw leaguesErr;

  const leagueApiIdToDbId = Object.fromEntries(activeLeagues.map(l => [l.api_id, l.id]));
  const activeLeagueApiIds = activeLeagues.map(l => l.api_id);

  console.log(`Ligas ativas (${activeLeagues.length}): ${activeLeagues.map(l => l.name).join(', ')}\n`);

  // 2. Busca jogos de hoje na API
  const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${today}&timezone=America/Sao_Paulo`);
  const matches = (data.response || []).filter(m => activeLeagueApiIds.includes(m.league.id));

  console.log(`Encontrados ${matches.length} jogos monitorados hoje.\n`);

  let upserted = 0;
  let errors = 0;

  for (const m of matches) {
    const apiId = m.fixture.id;
    const status = m.fixture.status.short;
    const dbLeagueId = leagueApiIdToDbId[m.league.id];

    // 3. Upsert times — insere automaticamente times novos (ex: Remo na estreia da Série A)
    const homeTeam = m.teams.home;
    const awayTeam = m.teams.away;

    const { data: dbTeams, error: teamErr } = await supabase
      .from('teams')
      .upsert(
        [
          { api_id: homeTeam.id, name: homeTeam.name, logo_url: homeTeam.logo, league_id: dbLeagueId },
          { api_id: awayTeam.id, name: awayTeam.name, logo_url: awayTeam.logo, league_id: dbLeagueId }
        ],
        { onConflict: 'api_id', ignoreDuplicates: false }
      )
      .select('id, api_id');

    if (teamErr) {
      console.error(`Erro ao upsert times para jogo ${apiId}:`, teamErr.message);
      errors++;
      continue;
    }

    const homeDbId = dbTeams.find(t => t.api_id === homeTeam.id)?.id;
    const awayDbId = dbTeams.find(t => t.api_id === awayTeam.id)?.id;

    if (!homeDbId || !awayDbId) {
      console.error(`IDs internos não resolvidos para jogo ${apiId}`);
      errors++;
      continue;
    }

    // 4. Upsert fixture — insere se novo, atualiza placar/status se já existe
    const fixtureData = {
      api_id: apiId,
      league_id: dbLeagueId,
      home_team_id: homeDbId,
      away_team_id: awayDbId,
      date: m.fixture.date,
      status: status,
      home_score: m.goals.home ?? null,
      away_score: m.goals.away ?? null,
      ht_home_score: m.score?.halftime?.home ?? null,
      ht_away_score: m.score?.halftime?.away ?? null,
      venue: m.fixture.venue?.name ?? null,
      round: m.league.round ?? null,
      season: m.league.season ?? null,
    };

    const { error: fixError } = await supabase
      .from('fixtures')
      .upsert(fixtureData, { onConflict: 'api_id' });

    if (fixError) {
      console.error(`Erro ao upsert jogo ${apiId}:`, fixError.message);
      errors++;
    } else {
      const scoreStr = (m.goals.home !== null) ? `${m.goals.home}-${m.goals.away}` : 'vs';
      console.log(`✓ [${status}] ${homeTeam.name} ${scoreStr} ${awayTeam.name}`);
      upserted++;
    }
  }

  console.log(`\n=== Concluído: ${upserted} jogos processados, ${errors} erros ===`);
}

syncToday().catch(console.error);
