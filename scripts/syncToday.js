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
  const today = process.argv[2] || brt.toISOString().split('T')[0];
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

    // Fetch existing teams if any to avoid overwriting their migrated logo_url
    const { data: existingTeams } = await supabase
      .from('teams')
      .select('api_id, logo_url')
      .in('api_id', [homeTeam.id, awayTeam.id]);

    const existingHome = existingTeams?.find(t => t.api_id === homeTeam.id);
    const existingAway = existingTeams?.find(t => t.api_id === awayTeam.id);

    const homeLogoUrl = (existingHome && existingHome.logo_url && !existingHome.logo_url.includes('api-sports'))
      ? existingHome.logo_url
      : homeTeam.logo;

    const awayLogoUrl = (existingAway && existingAway.logo_url && !existingAway.logo_url.includes('api-sports'))
      ? existingAway.logo_url
      : awayTeam.logo;

    const { data: dbTeams, error: teamErr } = await supabase
      .from('teams')
      .upsert(
        [
          { api_id: homeTeam.id, name: homeTeam.name, logo_url: homeLogoUrl, league_id: dbLeagueId },
          { api_id: awayTeam.id, name: awayTeam.name, logo_url: awayLogoUrl, league_id: dbLeagueId }
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

  console.log(`\n=== Sync: ${upserted} jogos processados, ${errors} erros ===`);

  // ── Reconciliation: fix fixtures in DB for today that API no longer lists ──
  // This happens when a fixture is rescheduled to a different date.
  const apiIdsToday = new Set(matches.map(m => m.fixture.id));

  const { data: dbFixturesToday } = await supabase
    .from('fixtures')
    .select('id, api_id')
    .gte('date', `${today}T00:00:00-03:00`)
    .lte('date', `${today}T23:59:59-03:00`)
    .eq('status', 'NS');

  const staleFixtures = (dbFixturesToday || []).filter(f => !apiIdsToday.has(f.api_id));

  if (staleFixtures.length > 0) {
    console.log(`\n⚠️  ${staleFixtures.length} fixture(s) no banco para hoje não encontrada(s) na API. Verificando remarcações...\n`);

    for (const stale of staleFixtures) {
      try {
        const fixData = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?id=${stale.api_id}`);
        const f = fixData.response?.[0];
        if (!f) {
          console.log(`  ? Fixture ${stale.api_id} não encontrada na API — ignorando.`);
          continue;
        }

        const newDate = f.fixture.date;
        const newStatus = f.fixture.status.short;
        const newDateLocal = new Date(newDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        // Only update if the date actually changed
        const { error: updErr } = await supabase
          .from('fixtures')
          .update({ date: newDate, status: newStatus })
          .eq('id', stale.id);

        if (updErr) {
          console.error(`  ✗ Erro ao atualizar fixture ${stale.api_id}:`, updErr.message);
        } else {
          console.log(`  ✓ Fixture ${stale.api_id} (${f.teams.home.name} vs ${f.teams.away.name}) remarcada → ${newDateLocal} [${newStatus}]`);
        }

        await new Promise(r => setTimeout(r, 1200));
      } catch (e) {
        console.error(`  ✗ Erro ao verificar fixture ${stale.api_id}:`, e.message);
      }
    }
  }

  console.log(`\n=== Concluído ===`);
}

syncToday().catch(console.error);
