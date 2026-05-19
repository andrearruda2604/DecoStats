/**
 * Backfill genérico: encontra todos os fixtures finalizados das ligas ativas
 * que têm apenas 1 registro em teams_history (em vez de 2) e insere o que falta.
 *
 * Causa: bug no sync onde se um time já tinha registro o outro era pulado.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = { ...process.env };
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!env[match[1].trim()]) env[match[1].trim()] = val;
    }
  });
} catch (_) {}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const headers = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function fetchApi(url) {
  for (let i = 3; i > 0; i--) {
    try {
      const r = await fetch(url, { headers });
      const d = await r.json();
      if (d.errors && Object.keys(d.errors).length) throw new Error(JSON.stringify(d.errors));
      return d.response || [];
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

const extractStat = (arr, type) => {
  const s = (arr || []).find(s => s.type === type);
  if (!s || s.value === null) return 0;
  if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
  return parseInt(s.value) || 0;
};

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('🔍 MODO DRY-RUN: nenhuma escrita no banco.\n');

  // 1. Ligas ativas
  const { data: leagues } = await sb.from('leagues').select('id, api_id, name').eq('is_active', true);
  if (!leagues?.length) { console.log('Nenhuma liga ativa.'); return; }

  const leagueDbIds = leagues.map(l => l.id);
  console.log(`Ligas ativas: ${leagues.map(l => l.name).join(', ')}\n`);

  // 2. Todos os fixtures finalizados dessas ligas
  const { data: fixtures } = await sb.from('fixtures')
    .select('api_id, date, season, league_id, home_score, away_score, ht_home_score, ht_away_score, home_team:teams!fixtures_home_team_id_fkey(api_id, name), away_team:teams!fixtures_away_team_id_fkey(api_id, name)')
    .in('league_id', leagueDbIds)
    .in('status', ['FT', 'AET', 'PEN'])
    .order('date');

  if (!fixtures?.length) { console.log('Nenhum fixture finalizado encontrado.'); return; }
  console.log(`Fixtures finalizados encontrados: ${fixtures.length}`);

  // 3. Registros existentes em teams_history
  const allApiIds = fixtures.map(f => f.api_id);
  const { data: existing } = await sb.from('teams_history')
    .select('fixture_id, team_id, is_home')
    .in('fixture_id', allApiIds);

  // Map: fixture_id → Set de team_ids com registro
  const existingMap = {};
  for (const r of existing || []) {
    if (!existingMap[r.fixture_id]) existingMap[r.fixture_id] = new Set();
    existingMap[r.fixture_id].add(r.team_id);
  }

  // 4. Identifica pares faltando
  const missing = [];
  for (const f of fixtures) {
    const present = existingMap[f.api_id] || new Set();
    if (!present.has(f.home_team.api_id)) missing.push({ fixture: f, side: 'home', teamObj: f.home_team, isHome: true });
    if (!present.has(f.away_team.api_id)) missing.push({ fixture: f, side: 'away', teamObj: f.away_team, isHome: false });
  }

  const missingFixtures = [...new Set(missing.map(m => m.fixture.api_id))];
  console.log(`\nRegistros faltando: ${missing.length} (em ${missingFixtures.length} fixtures)\n`);

  if (!missing.length) { console.log('✅ Tudo completo! Nenhum backfill necessário.'); return; }

  if (dryRun) {
    for (const m of missing) {
      const f = m.fixture;
      console.log(`  [falta ${m.side}] ${f.date?.slice(0,10)} — ${f.home_team?.name} ${f.home_score}-${f.away_score} ${f.away_team?.name} | time: ${m.teamObj.name} (${m.teamObj.api_id})`);
    }
    return;
  }

  // 5. Agrupa por fixture para fazer 1 chamada API por fixture
  const byFixture = {};
  for (const m of missing) {
    const id = m.fixture.api_id;
    if (!byFixture[id]) byFixture[id] = { fixture: m.fixture, sides: [] };
    byFixture[id].sides.push(m);
  }

  let done = 0, failed = 0;

  for (const [fixtureApiId, { fixture: f, sides }] of Object.entries(byFixture)) {
    console.log(`\n→ Fixture ${fixtureApiId} (${f.date?.slice(0, 10)}) ${f.home_team?.name} ${f.home_score}-${f.away_score} ${f.away_team?.name}`);

    const sRes = await fetchApi(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureApiId}&half=true`);
    await delay(1300);

    if (!sRes.length) { console.log('  ⚠️  Sem stats na API'); failed += sides.length; continue; }

    for (const { teamObj, isHome } of sides) {
      const raw = sRes.find(ts => ts.team.id === teamObj.api_id);
      if (!raw) { console.log(`  ⚠️  Sem stats para ${teamObj.name} (${teamObj.api_id})`); failed++; continue; }

      const goalsFor = isHome ? f.home_score : f.away_score;
      const goalsAg  = isHome ? f.away_score : f.home_score;

      const record = {
        fixture_id:       parseInt(fixtureApiId),
        team_id:          teamObj.api_id,
        opponent_id:      isHome ? f.away_team.api_id : f.home_team.api_id,
        is_home:          isHome,
        season:           f.season,
        league_id:        f.league_id,
        match_date:       f.date,
        goals_for:        goalsFor,
        goals_against:    goalsAg,
        shots_total:      extractStat(raw.statistics, 'Total Shots'),
        shots_on_goal:    extractStat(raw.statistics, 'Shots on Goal'),
        corners:          extractStat(raw.statistics, 'Corner Kicks'),
        yellow_cards:     extractStat(raw.statistics, 'Yellow Cards'),
        red_cards:        extractStat(raw.statistics, 'Red Cards'),
        possession:       extractStat(raw.statistics, 'Ball Possession'),
        fouls:            extractStat(raw.statistics, 'Fouls'),
        offsides:         extractStat(raw.statistics, 'Offsides'),
        goalkeeper_saves: extractStat(raw.statistics, 'Goalkeeper Saves'),
        passes_accurate:  extractStat(raw.statistics, 'Passes accurate'),
        stats_ft:         raw.statistics    || [],
        stats_1h:         raw.statistics_1h || [],
        stats_2h:         raw.statistics_2h || [],
      };

      const { error } = await sb.from('teams_history').upsert([record], { onConflict: 'fixture_id,team_id' });
      if (error) { console.error(`  ❌ ${teamObj.name}: ${error.message}`); failed++; }
      else { console.log(`  ✓ ${isHome ? 'home' : 'away'} ${teamObj.name}: ${goalsFor}-${goalsAg}`); done++; }
    }
  }

  console.log(`\n══════════════════════════════════`);
  console.log(`✅ Inseridos: ${done} | ❌ Falhos: ${failed}`);

  // 6. Conferência final
  const { data: after } = await sb.from('teams_history')
    .select('fixture_id, team_id')
    .in('fixture_id', missingFixtures);

  const afterMap = {};
  for (const r of after || []) {
    if (!afterMap[r.fixture_id]) afterMap[r.fixture_id] = 0;
    afterMap[r.fixture_id]++;
  }
  const stillMissing = missingFixtures.filter(id => (afterMap[id] || 0) < 2);
  if (stillMissing.length) {
    console.log(`\n⚠️  ${stillMissing.length} fixture(s) ainda incompletos: ${stillMissing.join(', ')}`);
  } else {
    console.log(`\n🏆 Todos os fixtures agora têm 2 registros em teams_history.`);
  }
}

run().catch(console.error);
