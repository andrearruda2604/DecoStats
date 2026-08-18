import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];
const API_KEY = env['VITE_API_FOOTBALL_KEY'] || env['API_FOOTBALL_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function fetchWithRetry(url) {
  let retries = 3;
  while(retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      if(data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
      return data;
    } catch(err) {
      console.warn("Fetch failed, retrying...", err.message);
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if(retries === 0) throw err;
    }
  }
}

async function seedWorldCup() {
    console.log('=== Inserindo Copa do Mundo 2026 ===\n');

    // 1. Upsert League
    const leagueData = {
        api_id: 1,
        name: 'World Cup',
        country: 'World',
        country_code: 'World',
        logo_url: 'https://media.api-sports.io/football/leagues/1.png',
        season: 2026,
        is_active: true
    };
    
    let { data: leagueDb, error: leagueErr } = await supabase.from('leagues').upsert(leagueData, { onConflict: 'api_id' }).select('id').single();
    if(leagueErr) {
        console.error("Erro ao inserir liga", leagueErr);
        return;
    }
    const dbLeagueId = leagueDb.id;
    console.log(`Liga inserida, ID no banco: ${dbLeagueId}`);

    // 2. Fetch Fixtures
    console.log(`Buscando fixtures da World Cup (ID 1), Season 2026...`);
    const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?league=1&season=2026`);
    const allMatches = data.response || [];
    
    // Filtro a partir de 11/06/2026
    const startDate = new Date('2026-06-11T00:00:00Z');
    // Para simplificar, vou filtrar por timestamp
    const matches = allMatches.filter(m => new Date(m.fixture.date) >= startDate);
    
    console.log(`Encontradas ${matches.length} partidas a partir de 11/06/2026.`);

    for (const m of matches) {
        const apiId = m.fixture.id;
        const status = m.fixture.status.short;

        const homeTeam = m.teams.home;
        const awayTeam = m.teams.away;

        // Fetch existing teams if any
        const { data: existingTeams } = await supabase
            .from('teams')
            .select('api_id, logo_url')
            .in('api_id', [homeTeam.id, awayTeam.id]);

        const existingHome = existingTeams?.find(t => t.api_id === homeTeam.id);
        const existingAway = existingTeams?.find(t => t.api_id === awayTeam.id);

        const homeLogoUrl = (existingHome && existingHome.logo_url && !existingHome.logo_url.includes('api-sports'))
            ? existingHome.logo_url
            : homeTeam.logo;

        const awayLogoUrl = (existingAway && existingAway.logo_url && !existingAway.logo_url.includes('api-sports'))
            ? existingAway.logo_url
            : awayTeam.logo;

        const { data: dbTeams, error: teamErr } = await supabase
            .from('teams')
            .upsert(
                [
                    { api_id: homeTeam.id, name: homeTeam.name, logo_url: homeLogoUrl, league_id: dbLeagueId },
                    { api_id: awayTeam.id, name: awayTeam.name, logo_url: awayLogoUrl, league_id: dbLeagueId }
                ],
                { onConflict: 'api_id', ignoreDuplicates: false }
            )
            .select('id, api_id');

        if (teamErr) {
            console.error(`Erro ao upsert times para jogo ${apiId}:`, teamErr.message);
            continue;
        }

        const homeDbId = dbTeams.find(t => t.api_id === homeTeam.id)?.id;
        const awayDbId = dbTeams.find(t => t.api_id === awayTeam.id)?.id;

        const fixtureData = {
            api_id: apiId,
            league_id: dbLeagueId,
            home_team_id: homeDbId,
            away_team_id: awayDbId,
            date: m.fixture.date,
            status: status,
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
        } else {
            console.log(`✓ Fixture ${apiId} salva. Status: ${status}`);
        }
    }
    
    console.log('\nDados de fixtures e times populados.');
    
    // Dispara migrate_logos para os times da Copa que vieram com a logo do api-sports
    console.log('Você pode rodar node scripts/migrate_logos.js e node scripts/syncMissingStats.js agora.');
}

seedWorldCup().catch(console.error);
