/**
 * 1. Restaura o histórico da Cremonese (api_id: 520) apagado por engano
 * 2. Semeia o Remo (api_id: 1198) com dados da Série A 2026
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

async function seedTeamHistory({ teamApiId, leagueId, season, label }) {
  console.log(`\n[${label}] api_id:${teamApiId} | liga:${leagueId} | temporada:${season}`);

  const data = await fetchWithRetry(
    `https://v3.football.api-sports.io/fixtures?team=${teamApiId}&league=${leagueId}&season=${season}`
  );

  const finished = (data.response || []).filter(f =>
    ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
  );
  console.log(`  Finalizados na API: ${finished.length}`);

  if (finished.length === 0) {
    console.log('  Nenhum jogo finalizado. Pulando.');
    return 0;
  }

  let saved = 0;
  for (const f of finished) {
    const fid = f.fixture.id;
    const isHome = f.teams.home.id === teamApiId;

    // Checa se já existe
    const { data: exists } = await supabase
      .from('teams_history')
      .select('fixture_id')
      .eq('fixture_id', fid)
      .eq('team_id', teamApiId)
      .maybeSingle();
    if (exists) { console.log(`  - ${fid} já existe, pulando.`); continue; }

    console.log(`  - [${isHome ? 'MANDANTE' : 'VISITANTE'}] ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name}`);

    const statsData = await fetchWithRetry(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`
    );
    await new Promise(r => setTimeout(r, 1200));

    const teamStatsRaw = (statsData.response || []).find(ts => ts.team.id === teamApiId);
    if (!teamStatsRaw) { console.log('    Sem stats, pulando.'); continue; }

    const ex = (type) => {
      const s = (teamStatsRaw.statistics || []).find(s => s.type === type);
      if (!s || s.value === null) return 0;
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
      return parseInt(s.value) || 0;
    };

    const { error } = await supabase.from('teams_history').insert([{
      fixture_id: fid,
      team_id: teamApiId,
      opponent_id: isHome ? f.teams.away.id : f.teams.home.id,
      is_home: isHome,
      season,
      league_id: leagueId,
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
    }]);

    if (error) console.error(`    ✗ ${error.message}`);
    else { console.log('    ✓ Salvo.'); saved++; }
  }
  return saved;
}

async function run() {
  // ── PARTE 1: Restaura Cremonese (apagada por engano) ──────────────────
  console.log('\n======= RESTAURANDO CREMONESE (api_id: 520) =======');

  // Tenta Serie A 2025 e 2024 (liga 135 - Italy Serie A)
  let cremSaved = await seedTeamHistory({ teamApiId: 520, leagueId: 135, season: 2025, label: 'Cremonese - Serie A 2025' });
  if (cremSaved === 0) {
    cremSaved += await seedTeamHistory({ teamApiId: 520, leagueId: 135, season: 2024, label: 'Cremonese - Serie A 2024' });
  }
  // Tenta Serie B (liga 136) se não achou na A
  if (cremSaved === 0) {
    cremSaved += await seedTeamHistory({ teamApiId: 520, leagueId: 136, season: 2025, label: 'Cremonese - Serie B 2025' });
  }
  if (cremSaved === 0) {
    cremSaved += await seedTeamHistory({ teamApiId: 520, leagueId: 136, season: 2024, label: 'Cremonese - Serie B 2024' });
  }
  console.log(`\n→ Cremonese: ${cremSaved} registros restaurados.`);

  // ── PARTE 2: Semeia Remo (api_id: 1198, Série A 2026) ─────────────────
  console.log('\n======= SEMEANDO REMO (api_id: 1198, Liga 71, 2026) =======');

  // Apaga qualquer dado antigo do Remo (outras ligas/temporadas)
  await supabase.from('teams_history').delete().eq('team_id', 1198);
  console.log('  Histórico antigo do Remo limpo.');

  const remoSaved = await seedTeamHistory({ teamApiId: 1198, leagueId: 71, season: 2026, label: 'Remo - Série A 2026' });
  console.log(`\n→ Remo: ${remoSaved} registros salvos.`);

  console.log('\n✅ Concluído!');
}

run().catch(console.error);
