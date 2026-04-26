/**
 * Apaga TODOS os dados da liga/temporada e repopula do zero.
 * Uso: node scripts/resetAndReseedLeague.js [league_api_id] [season]
 * Exemplo: node scripts/resetAndReseedLeague.js 71 2026
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
  console.error("Credenciais faltando");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const headers = { 'x-apisports-key': API_KEY };

const LEAGUE_API_ID = parseInt(process.argv[2] || '71');
const SEASON = parseInt(process.argv[3] || '2026');

async function fetchWithRetry(url) {
  for (let i = 3; i > 0; i--) {
    try {
      const r = await fetch(url, { headers });
      const d = await r.json();
      if (d.errors && Object.keys(d.errors).length > 0) throw new Error(JSON.stringify(d.errors));
      return d;
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ─── FASE 1: Limpar dados existentes ──────────────────────────────────

async function cleanLeague() {
  console.log(`\n=== FASE 1: Limpando dados da Liga ${LEAGUE_API_ID} / Temporada ${SEASON} ===\n`);

  // Resolve o ID interno da liga no banco
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, name')
    .eq('api_id', LEAGUE_API_ID)
    .single();

  if (leagueErr || !league) {
    console.error(`Liga api_id=${LEAGUE_API_ID} não encontrada.`);
    process.exit(1);
  }
  console.log(`Liga: ${league.name} (DB id: ${league.id})`);

  // 1. Busca todas as fixture IDs da liga/temporada
  const { data: fixtureRows, error: fErr } = await supabase
    .from('fixtures')
    .select('id')
    .eq('league_id', league.id)
    .eq('season', SEASON);

  if (fErr) throw fErr;
  const fixtureIds = (fixtureRows || []).map(f => f.id);
  console.log(`${fixtureIds.length} fixtures encontradas para deletar.`);

  // 2. Deleta fixture_events
  if (fixtureIds.length > 0) {
    const { error: evErr } = await supabase
      .from('fixture_events')
      .delete()
      .in('fixture_id', fixtureIds);
    if (evErr) console.error('Erro deletando fixture_events:', evErr.message);
    else console.log('✓ fixture_events limpos.');

    // 3. Deleta fixture_stats
    const { error: stErr } = await supabase
      .from('fixture_stats')
      .delete()
      .in('fixture_id', fixtureIds);
    if (stErr) console.error('Erro deletando fixture_stats:', stErr.message);
    else console.log('✓ fixture_stats limpos.');

    // 4. Deleta match_stats
    const { error: msErr } = await supabase
      .from('match_stats')
      .delete()
      .in('fixture_id', fixtureIds);
    if (msErr) console.warn('match_stats:', msErr.message);
    else console.log('✓ match_stats limpos.');

    // 5. Deleta fixtures
    const { error: fixErr } = await supabase
      .from('fixtures')
      .delete()
      .in('id', fixtureIds);
    if (fixErr) console.error('Erro deletando fixtures:', fixErr.message);
    else console.log('✓ fixtures limpas.');
  }

  // 6. Deleta teams_history (usa api_id da liga diretamente)
  const { error: thErr } = await supabase
    .from('teams_history')
    .delete()
    .eq('league_id', LEAGUE_API_ID)
    .eq('season', SEASON);
  if (thErr) console.error('Erro deletando teams_history:', thErr.message);
  else console.log('✓ teams_history limpos.');

  return league;
}

// ─── FASE 2: Seed de Fixtures ──────────────────────────────────────────

async function seedFixtures(league) {
  console.log(`\n=== FASE 2: Populando Fixtures (Liga ${LEAGUE_API_ID} / ${SEASON}) ===\n`);

  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_API_ID}&season=${SEASON}`
  );

  const fixtures = data.response || [];
  console.log(`${fixtures.length} fixtures encontradas na API.\n`);

  let ok = 0, fail = 0;
  for (const m of fixtures) {
    const homeTeam = m.teams.home;
    const awayTeam = m.teams.away;

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

    if (teamErr) { console.error('Erro times:', teamErr.message); fail++; continue; }

    const homeDbId = dbTeams.find(t => t.api_id === homeTeam.id)?.id;
    const awayDbId = dbTeams.find(t => t.api_id === awayTeam.id)?.id;
    if (!homeDbId || !awayDbId) { fail++; continue; }

    const { error: fixErr } = await supabase.from('fixtures').upsert({
      api_id: m.fixture.id,
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
    }, { onConflict: 'api_id' });

    if (fixErr) { console.error(`Fixture ${m.fixture.id}:`, fixErr.message); fail++; }
    else {
      const score = m.goals.home !== null ? `${m.goals.home}-${m.goals.away}` : 'vs';
      console.log(`✓ [${m.fixture.status.short}] ${homeTeam.name} ${score} ${awayTeam.name} (${m.league.round})`);
      ok++;
    }
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\nFixtures: ${ok} OK, ${fail} erros.`);
}

// ─── FASE 3: Seed de teams_history ────────────────────────────────────

async function seedTeamHistory(teamApiId, teamName) {
  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?team=${teamApiId}&league=${LEAGUE_API_ID}&season=${SEASON}`
  );

  const finished = (data.response || []).filter(f =>
    ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
  );

  console.log(`  ${finished.length} jogos finalizados.`);
  let saved = 0;

  for (const f of finished) {
    const fid = f.fixture.id;
    console.log(`  - Stats fixture ${fid}...`);

    const statsData = await fetchWithRetry(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`
    );
    await new Promise(r => setTimeout(r, 1200));

    const teamStatsRaw = (statsData.response || []).find(ts => ts.team.id === teamApiId);
    if (!teamStatsRaw) { console.log(`  - Sem stats, pulando.`); continue; }

    const extractStat = (arr, type) => {
      const s = (arr || []).find(s => s.type === type);
      if (!s || s.value === null) return 0;
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
      return parseInt(s.value) || 0;
    };

    const isHome = f.teams.home.id === teamApiId;
    const record = {
      fixture_id: fid,
      team_id: teamApiId,
      opponent_id: isHome ? f.teams.away.id : f.teams.home.id,
      is_home: isHome,
      season: SEASON,
      league_id: LEAGUE_API_ID,
      match_date: f.fixture.date,
      goals_for: isHome ? f.goals.home : f.goals.away,
      goals_against: isHome ? f.goals.away : f.goals.home,
      shots_total: extractStat(teamStatsRaw.statistics, 'Total Shots'),
      shots_on_goal: extractStat(teamStatsRaw.statistics, 'Shots on Goal'),
      corners: extractStat(teamStatsRaw.statistics, 'Corner Kicks'),
      yellow_cards: extractStat(teamStatsRaw.statistics, 'Yellow Cards'),
      red_cards: extractStat(teamStatsRaw.statistics, 'Red Cards'),
      possession: extractStat(teamStatsRaw.statistics, 'Ball Possession'),
      fouls: extractStat(teamStatsRaw.statistics, 'Fouls'),
      offsides: extractStat(teamStatsRaw.statistics, 'Offsides'),
      goalkeeper_saves: extractStat(teamStatsRaw.statistics, 'Goalkeeper Saves'),
      passes_accurate: extractStat(teamStatsRaw.statistics, 'Passes accurate'),
      stats_ft: teamStatsRaw.statistics || [],
      stats_1h: teamStatsRaw.statistics_1h || [],
      stats_2h: teamStatsRaw.statistics_2h || [],
    };

    const { error } = await supabase.from('teams_history').insert([record]);
    if (error) console.error(`  ✗ ${error.message}`);
    else { console.log(`  ✓ [${isHome ? 'MANDANTE' : 'VISITANTE'}] salvo`); saved++; }
  }
  return saved;
}

async function seedAllHistory() {
  console.log(`\n=== FASE 3: Populando teams_history (Liga ${LEAGUE_API_ID} / ${SEASON}) ===\n`);

  // Coleta times distintos das fixtures recém-inseridas
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(api_id, name), away_team:teams!fixtures_away_team_id_fkey(api_id, name)')
    .eq('season', SEASON);

  const teamMap = new Map();
  for (const f of fixtures || []) {
    if (f.home_team) teamMap.set(f.home_team.api_id, f.home_team.name);
    if (f.away_team) teamMap.set(f.away_team.api_id, f.away_team.name);
  }

  console.log(`${teamMap.size} times encontrados.\n`);
  let total = 0;

  for (const [apiId, name] of teamMap) {
    console.log(`\n[${name} | api_id: ${apiId}]`);
    total += await seedTeamHistory(apiId, name);
  }

  console.log(`\n=== FASE 3 concluída: ${total} registros inseridos ===`);
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const league = await cleanLeague();
  await seedFixtures(league);
  await seedAllHistory();
  console.log('\n✅ Reset e reseed completos!');
}

main().catch(console.error);
