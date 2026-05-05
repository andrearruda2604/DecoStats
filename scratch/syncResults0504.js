import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const API_KEY = env.VITE_API_FOOTBALL_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncResults(dateStr) {
  console.log(`\n=== Sincronizando Resultados para ${dateStr} ===`);
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  const json = await resp.json();
  const matches = json.response || [];
  console.log(`API retornou ${matches.length} jogos.`);

  const { data: dbFixtures } = await supabase.from('fixtures')
    .select('api_id')
    .gte('date', `${dateStr}T00:00:00Z`)
    .lte('date', `${dateStr}T23:59:59Z`);
  const dbApiIds = new Set((dbFixtures || []).map(f => f.api_id));

  for (const m of matches) {
    if (!dbApiIds.has(m.fixture.id)) continue;

    const isFT = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short);
    
    // Update fixture
    await supabase.from('fixtures').update({
      status: m.fixture.status.short,
      home_score: m.goals.home,
      away_score: m.goals.away,
      ht_home_score: m.score.halftime.home,
      ht_away_score: m.score.halftime.away,
      score: m.score
    }).eq('api_id', m.fixture.id);

    if (isFT) {
      console.log(`✅ ${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name} (FT)`);
      // Update teams_history to allow corner/card settlement
      const statsResp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${m.fixture.id}`, {
        headers: { 'x-apisports-key': API_KEY }
      });
      const statsJson = await statsResp.json();
      const stats = statsJson.response || [];

      for (const s of stats) {
        const isHome = s.team.id === m.teams.home.id;
        const corners = s.statistics.find(st => st.type === 'Corner Kicks')?.value || 0;
        const yellow = s.statistics.find(st => st.type === 'Yellow Cards')?.value || 0;
        const red = s.statistics.find(st => st.type === 'Red Cards')?.value || 0;

        await supabase.from('teams_history').upsert({
          fixture_id: m.fixture.id,
          team_id: s.team.id,
          league_id: m.league.id,
          season: m.league.season,
          match_date: m.fixture.date,
          is_home: isHome,
          goals_for: isHome ? m.goals.home : m.goals.away,
          goals_against: isHome ? m.goals.away : m.goals.home,
          corners: corners,
          yellow_cards: yellow,
          red_cards: red,
          stats_ft: s.statistics
        }, { onConflict: 'fixture_id,team_id' });
      }
    }
  }
}

async function run() {
  const date = process.argv[2] || '2026-05-04';
  await syncResults(date);
  console.log('\nSincronização concluída. Os bilhetes serão liquidados automaticamente no próximo ciclo ou você pode atualizar a página.');
}

run().catch(console.error);
