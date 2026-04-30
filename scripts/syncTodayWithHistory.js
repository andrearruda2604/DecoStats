/**
 * Sincroniza jogos de hoje e semeia o histórico dos times que jogam hoje.
 * Uso: node scripts/syncTodayWithHistory.js
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
  console.error('Credenciais faltando');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

const MAX_MATCHES = 40;

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

// ─── Parte 1: sync de hoje ────────────────────────────────────────────

async function syncToday() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = brt.toISOString().split('T')[0];
  console.log(`\n=== PARTE 1: Sincronizando jogos de hoje (${today} BRT) ===\n`);

  const { data: activeLeagues, error: leaguesErr } = await supabase
    .from('leagues')
    .select('id, api_id, name')
    .eq('is_active', true);

  if (leaguesErr) throw leaguesErr;

  const leagueApiIdToDbId = Object.fromEntries(activeLeagues.map(l => [l.api_id, l.id]));
  const activeLeagueApiIds = activeLeagues.map(l => l.api_id);

  console.log(`Ligas ativas (${activeLeagues.length}): ${activeLeagues.map(l => l.name).join(', ')}\n`);

  const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${today}&timezone=America/Sao_Paulo`);
  const matches = (data.response || []).filter(m => activeLeagueApiIds.includes(m.league.id));

  console.log(`${matches.length} jogos monitorados hoje.\n`);

  let upserted = 0;
  let errors = 0;

  for (const m of matches) {
    const apiId = m.fixture.id;
    const status = m.fixture.status.short;
    const dbLeagueId = leagueApiIdToDbId[m.league.id];

    const homeTeam = m.teams.home;
    const awayTeam = m.teams.away;

    const { data: dbTeams, error: teamErr } = await supabase
      .from('teams')
      .upsert(
        [
          { api_id: homeTeam.id, name: homeTeam.name, logo_url: homeTeam.logo, league_id: dbLeagueId },
          { api_id: awayTeam.id, name: awayTeam.name, logo_url: awayTeam.logo, league_id: dbLeagueId },
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

    const fixtureData = {
      api_id: apiId,
      league_id: dbLeagueId,
      home_team_id: homeDbId,
      away_team_id: awayDbId,
      date: m.fixture.date,
      status,
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
      const scoreStr = m.goals.home !== null ? `${m.goals.home}-${m.goals.away}` : 'vs';
      console.log(`✓ [${status}] ${homeTeam.name} ${scoreStr} ${awayTeam.name} (${m.league.name})`);
      upserted++;
    }
  }

  console.log(`\nSync concluído: ${upserted} jogos, ${errors} erros.`);
  return matches;
}

// ─── Parte 2: histórico dos times que jogam hoje ───────────────────────

async function seedTeamHistory(teamApiId, leagueApiId, season, teamName) {
  const { data: existing } = await supabase
    .from('teams_history')
    .select('fixture_id')
    .eq('team_id', teamApiId)
    .eq('season', season)
    .eq('league_id', leagueApiId);

  const existingIds = new Set((existing || []).map(r => r.fixture_id));
  console.log(`  [${teamName}] ${existingIds.size} registros já no banco.`);

  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?team=${teamApiId}&league=${leagueApiId}&season=${season}`
  );

  const finished = (data.response || [])
    .filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short))
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, MAX_MATCHES);

  console.log(`  [${teamName}] ${finished.length} jogos finalizados na API (limitado a ${MAX_MATCHES}).`);

  let saved = 0;
  for (const f of finished) {
    const fid = f.fixture.id;
    if (existingIds.has(fid)) continue;

    console.log(`  [${teamName}] Buscando stats fixture ${fid}...`);
    const statsData = await fetchWithRetry(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`
    );
    await new Promise(r => setTimeout(r, 1200));

    const teamStatsRaw = (statsData.response || []).find(ts => ts.team.id === teamApiId);
    if (!teamStatsRaw) continue;

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
      season,
      league_id: leagueApiId,
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
    if (error) console.error(`  ✗ ${teamName} fixture ${fid}:`, error.message);
    else { console.log(`  ✓ ${teamName} [${isHome ? 'MANDANTE' : 'VISITANTE'}] fixture ${fid}`); saved++; }
  }

  return saved;
}

async function seedTodayTeams(todayMatches) {
  console.log(`\n=== PARTE 2: Histórico dos times que jogam hoje ===\n`);

  // Monta mapa: teamApiId → { name, leagueApiId, season }
  const teamMap = new Map();
  for (const m of todayMatches) {
    const leagueApiId = m.league.id;
    const season = m.league.season;
    for (const side of [m.teams.home, m.teams.away]) {
      if (!teamMap.has(side.id)) {
        teamMap.set(side.id, { name: side.name, leagueApiId, season });
      }
    }
  }

  console.log(`${teamMap.size} times únicos para semear.\n`);

  let total = 0;
  for (const [apiId, { name, leagueApiId, season }] of teamMap) {
    console.log(`\n→ ${name} (liga: ${leagueApiId}, temporada: ${season})`);
    const saved = await seedTeamHistory(apiId, leagueApiId, season, name);
    total += saved;
  }

  console.log(`\n=== PARTE 2 concluída: ${total} registros inseridos em teams_history ===`);
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const todayMatches = await syncToday();
  if (todayMatches.length > 0) {
    await seedTodayTeams(todayMatches);
  } else {
    console.log('\nNenhum jogo hoje, nada a semear.');
  }
}

main().catch(console.error);
