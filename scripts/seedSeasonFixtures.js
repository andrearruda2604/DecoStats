/**
 * Popula fixtures de uma liga/temporada inteira no banco.
 * Uso: node scripts/seedSeasonFixtures.js [league_api_id] [season]
 * Exemplo: node scripts/seedSeasonFixtures.js 71 2026
 */

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

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error("Credenciais faltando (.env.local ou variáveis de ambiente)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

const LEAGUE_API_ID = parseInt(process.argv[2] || '71');
const SEASON = parseInt(process.argv[3] || new Date().getFullYear());

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

async function seed() {
  console.log(`=== Seed de Fixtures: Liga ${LEAGUE_API_ID}, Temporada ${SEASON} ===\n`);

  // Resolve ID interno da liga no banco
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, name')
    .eq('api_id', LEAGUE_API_ID)
    .single();

  if (leagueErr || !league) {
    console.error(`Liga com api_id=${LEAGUE_API_ID} não encontrada no banco. Verifique se ela existe na tabela 'leagues' com is_active=true.`);
    process.exit(1);
  }

  console.log(`Liga encontrada: ${league.name} (DB id: ${league.id})\n`);

  // Busca todas as fixtures da temporada na API
  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_API_ID}&season=${SEASON}`
  );

  const fixtures = data.response || [];
  console.log(`${fixtures.length} fixtures encontradas na API.\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const m of fixtures) {
    const apiId = m.fixture.id;
    const homeTeam = m.teams.home;
    const awayTeam = m.teams.away;

    // Upsert times
    const { data: dbTeams, error: teamErr } = await supabase
      .from('teams')
      .upsert(
        [
          { api_id: homeTeam.id, name: homeTeam.name, logo_url: homeTeam.logo, league_id: league.id },
          { api_id: awayTeam.id, name: awayTeam.name, logo_url: awayTeam.logo, league_id: league.id }
        ],
        { onConflict: 'api_id', ignoreDuplicates: false }
      )
      .select('id, api_id');

    if (teamErr) {
      console.error(`Erro times para fixture ${apiId}:`, teamErr.message);
      errors++;
      continue;
    }

    const homeDbId = dbTeams.find(t => t.api_id === homeTeam.id)?.id;
    const awayDbId = dbTeams.find(t => t.api_id === awayTeam.id)?.id;

    if (!homeDbId || !awayDbId) {
      console.error(`IDs não resolvidos para fixture ${apiId}`);
      errors++;
      continue;
    }

    const { error: fixErr, count } = await supabase
      .from('fixtures')
      .upsert(
        {
          api_id: apiId,
          league_id: league.id,
          home_team_id: homeDbId,
          away_team_id: awayDbId,
          date: m.fixture.date,
          status: m.fixture.status.short,
          home_score: m.goals.home ?? null,
          away_score: m.goals.away ?? null,
          ht_home_score: m.score?.halftime?.home ?? null,
          ht_away_score: m.score?.halftime?.away ?? null,
          venue: m.fixture.venue?.name ?? null,
          round: m.league.round ?? null,
          season: m.league.season ?? null,
        },
        { onConflict: 'api_id' }
      );

    if (fixErr) {
      console.error(`Erro fixture ${apiId}:`, fixErr.message);
      errors++;
    } else {
      const scoreStr = (m.goals.home !== null) ? `${m.goals.home}-${m.goals.away}` : 'vs';
      const statusStr = m.fixture.status.short;
      console.log(`✓ [${statusStr}] ${homeTeam.name} ${scoreStr} ${awayTeam.name} (rodada: ${m.league.round})`);
      inserted++;
    }

    // Pequena pausa para não sobrecarregar a API
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n=== Seed concluído: ${inserted} fixtures processadas, ${errors} erros ===`);
}

seed().catch(console.error);
