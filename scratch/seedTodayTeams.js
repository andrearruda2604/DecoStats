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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function seedTodayTeams() {
  const today = '2026-05-05';
  const { data: fixtures } = await supabase.from('fixtures')
    .select('home_team_id, away_team_id')
    .gte('date', `${today} 00:00:00`)
    .lte('date', `${today} 23:59:59`);
  
  const teamIds = new Set();
  fixtures?.forEach(f => {
    teamIds.add(f.home_team_id);
    teamIds.add(f.away_team_id);
  });

  console.log(`Verificando ${teamIds.size} times...`);

  for (const id of teamIds) {
    const { data: existing } = await supabase.from('teams').select('id').eq('api_id', id).maybeSingle();
    if (existing) continue;

    console.log(`Semeando time ${id}...`);
    const resp = await fetch(`https://v3.football.api-sports.io/teams?id=${id}`, { headers: API_HEADERS });
    const json = await resp.json();
    const team = json.response?.[0]?.team;

    if (team) {
      await supabase.from('teams').insert({
        api_id: team.id,
        name: team.name,
        short_name: team.code,
        logo_url: team.logo
      });
      console.log(`✓ ${team.name} salvo.`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log("Concluído!");
}

seedTodayTeams().catch(console.error);
