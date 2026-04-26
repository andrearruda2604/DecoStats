/**
 * Limpa e repopula o histórico do Remo apenas com dados da Série A 2026 (liga 71).
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY };

const LEAGUE_ID = 71;
const SEASON = 2026;

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

async function run() {
  // 1. Encontra o Remo no banco
  const { data: teams } = await supabase
    .from('teams')
    .select('id, api_id, name')
    .ilike('name', '%remo%');

  if (!teams || teams.length === 0) {
    console.error('Remo não encontrado na tabela teams. Rode seedSeasonFixtures.js 71 2026 primeiro.');
    process.exit(1);
  }

  const remo = teams[0];
  console.log(`Remo encontrado: ${remo.name} | api_id: ${remo.api_id} | db id: ${remo.id}\n`);

  // 2. Apaga TODO o histórico do Remo (de qualquer liga/temporada)
  const { error: delErr, count } = await supabase
    .from('teams_history')
    .delete()
    .eq('team_id', remo.api_id);

  if (delErr) { console.error('Erro ao deletar:', delErr.message); process.exit(1); }
  console.log(`✓ Histórico antigo do Remo apagado.\n`);

  // 3. Busca jogos finalizados do Remo na Série A 2026
  console.log(`Buscando fixtures do Remo na Série A ${SEASON} (liga ${LEAGUE_ID})...`);
  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?team=${remo.api_id}&league=${LEAGUE_ID}&season=${SEASON}`
  );

  const all = data.response || [];
  const finished = all.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));

  console.log(`Total pela API: ${all.length} | Finalizados: ${finished.length}\n`);

  if (finished.length === 0) {
    console.log('Nenhum jogo finalizado encontrado na API para esses parâmetros.');
    console.log('Verifique se o api_id acima é o correto para o Remo na Série A 2026.');
    return;
  }

  // 4. Para cada jogo finalizado, busca stats e insere
  let saved = 0;
  for (const f of finished) {
    const fid = f.fixture.id;
    const isHome = f.teams.home.id === remo.api_id;
    console.log(`[${isHome ? 'MANDANTE' : 'VISITANTE'}] ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} | fixture: ${fid}`);

    const statsData = await fetchWithRetry(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`
    );
    await new Promise(r => setTimeout(r, 1200));

    const teamStatsRaw = (statsData.response || []).find(ts => ts.team.id === remo.api_id);
    if (!teamStatsRaw) {
      console.log('  ✗ Sem stats para este jogo, pulando.\n');
      continue;
    }

    const ex = (type) => {
      const s = (teamStatsRaw.statistics || []).find(s => s.type === type);
      if (!s || s.value === null) return 0;
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
      return parseInt(s.value) || 0;
    };

    const record = {
      fixture_id: fid,
      team_id: remo.api_id,
      opponent_id: isHome ? f.teams.away.id : f.teams.home.id,
      is_home: isHome,
      season: SEASON,
      league_id: LEAGUE_ID,
      match_date: f.fixture.date,
      goals_for: isHome ? f.goals.home : f.goals.away,
      goals_against: isHome ? f.goals.away : f.goals.home,
      shots_total: ex('Total Shots'),
      shots_on_goal: ex('Shots on Goal'),
      corners: ex('Corner Kicks'),
      yellow_cards: ex('Yellow Cards'),
      red_cards: ex('Red Cards'),
      possession: ex('Ball Possession'),
      fouls: ex('Fouls'),
      offsides: ex('Offsides'),
      goalkeeper_saves: ex('Goalkeeper Saves'),
      passes_accurate: ex('Passes accurate'),
      stats_ft: teamStatsRaw.statistics || [],
      stats_1h: teamStatsRaw.statistics_1h || [],
      stats_2h: teamStatsRaw.statistics_2h || [],
    };

    const { error } = await supabase.from('teams_history').insert([record]);
    if (error) console.error(`  ✗ Erro: ${error.message}\n`);
    else { console.log(`  ✓ Salvo.\n`); saved++; }
  }

  console.log(`\n=== Concluído: ${saved}/${finished.length} jogos salvos em teams_history ===`);
}

run().catch(console.error);
