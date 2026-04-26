/**
 * Semeia teams_history para todos os times de uma liga/temporada.
 * Uso: node scripts/seedLeagueHistory.js [league_api_id] [season]
 * Exemplo: node scripts/seedLeagueHistory.js 71 2026
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

async function seedTeam(teamApiId) {
  const { data: existing, count } = await supabase
    .from('teams_history')
    .select('fixture_id', { count: 'exact', head: false })
    .eq('team_id', teamApiId)
    .eq('season', SEASON)
    .eq('league_id', LEAGUE_API_ID);

  const existingIds = new Set((existing || []).map(r => r.fixture_id));
  console.log(`  Já tem ${existingIds.size} registros no banco para temporada ${SEASON}.`);

  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?team=${teamApiId}&league=${LEAGUE_API_ID}&season=${SEASON}`
  );

  const finished = (data.response || []).filter(f =>
    ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
  );

  console.log(`  ${finished.length} jogos finalizados na API.`);

  let saved = 0;
  for (const f of finished) {
    const fid = f.fixture.id;
    if (existingIds.has(fid)) {
      console.log(`  - Fixture ${fid} já existe, pulando.`);
      continue;
    }

    console.log(`  - Buscando stats da fixture ${fid}...`);
    const statsData = await fetchWithRetry(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`
    );
    await new Promise(r => setTimeout(r, 1200));

    const teamStatsRaw = (statsData.response || []).find(ts => ts.team.id === teamApiId);
    if (!teamStatsRaw) {
      console.log(`  - Sem stats para time ${teamApiId} na fixture ${fid}, pulando.`);
      continue;
    }

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
    if (error) console.error(`  ✗ Erro ao salvar fixture ${fid}:`, error.message);
    else { console.log(`  ✓ Salvo [${isHome ? 'MANDANTE' : 'VISITANTE'}] fixture ${fid}`); saved++; }
  }

  return saved;
}

async function run() {
  console.log(`=== Seed de Histórico: Liga ${LEAGUE_API_ID}, Temporada ${SEASON} ===\n`);

  // Busca todos os times distintos da liga/temporada a partir das fixtures no banco
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('home_team:teams!fixtures_home_team_id_fkey(id, api_id, name), away_team:teams!fixtures_away_team_id_fkey(id, api_id, name)')
    .eq('season', SEASON);

  if (error) throw error;

  const teamMap = new Map();
  for (const f of fixtures || []) {
    if (f.home_team) teamMap.set(f.home_team.api_id, f.home_team.name);
    if (f.away_team) teamMap.set(f.away_team.api_id, f.away_team.name);
  }

  console.log(`${teamMap.size} times encontrados nas fixtures do banco.\n`);

  let total = 0;
  for (const [apiId, name] of teamMap) {
    console.log(`\n[${name} | api_id: ${apiId}]`);
    const saved = await seedTeam(apiId);
    total += saved;
  }

  console.log(`\n=== Concluído: ${total} registros inseridos em teams_history ===`);
}

run().catch(console.error);
