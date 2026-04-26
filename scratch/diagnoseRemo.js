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

async function run() {
  // 1. Acha o Remo no banco
  const { data: teams } = await supabase
    .from('teams')
    .select('id, api_id, name')
    .ilike('name', '%remo%');

  console.log('\n=== TIMES COM "REMO" NO BANCO ===');
  console.log(teams);

  if (!teams || teams.length === 0) {
    console.log('Remo não encontrado na tabela teams!');
    return;
  }

  const remo = teams[0];
  console.log(`\nUsando: ${remo.name} (api_id: ${remo.api_id})`);

  // 2. Quantos registros tem no teams_history
  const { data: history, error: hErr } = await supabase
    .from('teams_history')
    .select('fixture_id, is_home, season, league_id, match_date, goals_for, goals_against')
    .eq('team_id', remo.api_id)
    .order('match_date', { ascending: false });

  console.log('\n=== TEAMS_HISTORY DO REMO ===');
  console.log(`Total de registros: ${history?.length ?? 0}`);
  console.log(history);

  // 3. Fixtures do Remo no banco
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('api_id, date, status, round, home_score, away_score, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .or(`home_team_id.eq.${remo.id},away_team_id.eq.${remo.id}`)
    .eq('season', 2026)
    .order('date', { ascending: true });

  console.log('\n=== FIXTURES DO REMO NA LIGA 71 / 2026 (banco) ===');
  console.log(`Total: ${fixtures?.length ?? 0}`);
  (fixtures || []).forEach(f => {
    console.log(`  [${f.status}] ${f.round} | ${f.home_team?.name} ${f.home_score ?? '?'}-${f.away_score ?? '?'} ${f.away_team?.name} | api_id: ${f.api_id}`);
  });

  // 4. O que a API retorna para o Remo na liga 71 season 2026
  console.log('\n=== API-FOOTBALL: fixtures?team=X&league=71&season=2026 ===');
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?team=${remo.api_id}&league=71&season=2026`,
    { headers }
  );
  const data = await res.json();
  const apiFixtures = data.response || [];
  console.log(`Total retornado pela API: ${apiFixtures.length}`);
  apiFixtures.forEach(f => {
    console.log(`  [${f.fixture.status.short}] ${f.league.round} | ${f.teams.home.name} ${f.goals.home ?? '?'}-${f.goals.away ?? '?'} ${f.teams.away.name}`);
  });

  const finished = apiFixtures.filter(f => ['FT','AET','PEN'].includes(f.fixture.status.short));
  console.log(`\nFinalizados na API: ${finished.length}`);
}

run().catch(console.error);
