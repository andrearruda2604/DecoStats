import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

// Fix the 6 fixtures with wrong dates
const fixturesToFix = [1520730, 1520736, 1520731, 1520733, 1520734, 1520737];

console.log('=== Corrigindo datas de fixtures com data errada ===\n');

for (const apiId of fixturesToFix) {
  const url = `https://v3.football.api-sports.io/fixtures?id=${apiId}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  const f = data.response?.[0];
  
  if (!f) {
    console.error(`  ✗ Fixture ${apiId} não encontrada na API`);
    continue;
  }

  const correctDate = f.fixture.date;
  const status = f.fixture.status.short;
  
  const { error } = await supabase
    .from('fixtures')
    .update({ date: correctDate, status })
    .eq('api_id', apiId);
  
  if (error) {
    console.error(`  ✗ Erro ao atualizar fixture ${apiId}:`, error.message);
  } else {
    console.log(`  ✓ ${f.teams.home.name} vs ${f.teams.away.name}: ${correctDate} [${status}]`);
  }
  
  await new Promise(r => setTimeout(r, 1200));
}

console.log('\n=== Correção concluída ===');

// Verify: count Serie B fixtures for today
const { data: todayFixtures } = await supabase
  .from('fixtures')
  .select('id, api_id, date, status, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
  .gte('date', '2026-06-20T00:00:00-03:00')
  .lte('date', '2026-06-20T23:59:59-03:00')
  .eq('league_id', 89);

console.log(`\nSerie B fixtures para hoje: ${todayFixtures?.length || 0}`);
for (const f of (todayFixtures || [])) {
  console.log(`  [${f.status}] ${f.home_team?.name} vs ${f.away_team?.name} - ${f.date}`);
}
