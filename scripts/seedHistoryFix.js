import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_KEY = env.VITE_API_FOOTBALL_KEY;

async function seedHistory(leagueId, season) {
    console.log(`🌐 Buscando Histórico: Liga ${leagueId}, Temporada ${season}...`);
    
    // 1. Pegar os times dessa liga no nosso banco
    const { data: dbLeagues } = await supabase.from('leagues').select('id').eq('api_id', leagueId).single();
    if (!dbLeagues) return;

    // 2. Buscar jogos finalizados da API para essa liga/season
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&status=FT`, {
        headers: { 'x-apisports-key': API_KEY }
    });
    const json = await resp.json();
    const fixtures = json.response;

    if (!fixtures || fixtures.length === 0) return;

    console.log(`Encontrados ${fixtures.length} jogos históricos.`);

    for (const f of fixtures.slice(-50)) { // Pegar os últimos 50 jogos
        const { data: homeTeam } = await supabase.from('teams').select('id').eq('api_id', f.teams.home.id).single();
        const { data: awayTeam } = await supabase.from('teams').select('id').eq('api_id', f.teams.away.id).single();

        if (homeTeam && awayTeam) {
            const entry = {
                team_id: homeTeam.id,
                opp_id: awayTeam.id,
                fixture_api_id: f.fixture.id,
                match_date: f.fixture.date,
                is_home: true,
                goals_for: f.goals.home,
                goals_against: f.goals.away,
                league_id: dbLeagues.id,
                status: 'FT'
            };
            await supabase.from('teams_history').upsert(entry, { onConflict: 'fixture_api_id, team_id' });
            
            const entryAway = {
                team_id: awayTeam.id,
                opp_id: homeTeam.id,
                fixture_api_id: f.fixture.id,
                match_date: f.fixture.date,
                is_home: false,
                goals_for: f.goals.away,
                goals_against: f.goals.home,
                league_id: dbLeagues.id,
                status: 'FT'
            };
            await supabase.from('teams_history').upsert(entryAway, { onConflict: 'fixture_api_id, team_id' });
        }
    }
    console.log(`✅ Liga ${leagueId} sincronizada.`);
}

async function run() {
    const leagues = [39, 140, 135, 78, 61, 94]; // Europa
    for (const l of leagues) {
        await seedHistory(l, 2025);
    }
    await seedHistory(71, 2026); // Brasil
}

run();
