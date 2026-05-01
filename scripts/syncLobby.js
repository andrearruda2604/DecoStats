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
const API_KEY = env['VITE_API_FOOTBALL_KEY'] || 'd5815b50acea81aba8152a13c20209c0';

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
      if(data.errors && Object.keys(data.errors).length > 0) {
        console.error("API Error: ", data.errors);
        throw new Error(JSON.stringify(data.errors));
      }
      return data;
    } catch(err) {
      console.warn("Fetch failed, retrying in 2s...", url);
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if(retries === 0) throw err;
    }
  }
}

async function syncLobbyFixtures() {
  console.log('Starting Fixtures Sync (Yesterday + Next 7 days)...');
  
  // 1. Carrega ligas ativas do banco
  const { data: activeLeagues, error: leaguesErr } = await supabase
    .from('leagues')
    .select('id, api_id, name')
    .eq('is_active', true);

  if (leaguesErr) throw leaguesErr;
  const leagueApiIdToDbId = Object.fromEntries(activeLeagues.map(l => [l.api_id, l.id]));
  const LEAGUES_TO_SYNC = activeLeagues.map(l => l.api_id);
  console.log(`Ligas ativas monitoradas (${LEAGUES_TO_SYNC.length}): ${activeLeagues.map(l => l.name).join(', ')}`);

  // Configurações e Datas
  const argDate = process.argv[2]; // Formato YYYY-MM-DD
  const today = new Date();
  const targetDate = argDate ? new Date(argDate + 'T12:00:00Z') : today;

  const dateStr = targetDate.toISOString().split('T')[0];
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  console.log(`Iniciando Sincronização para data base: ${dateStr}...`);
  
  // Start from -1 (yesterday) to update results of finished games
  for (let i = -1; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`\nFetching fixtures for ${dateStr}...`);
    const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?date=${dateStr}&timezone=America/Sao_Paulo`);
    const matches = data.response || [];
    
    // Filter for our mapped leagues
    const validMatches = matches.filter(m => LEAGUES_TO_SYNC.includes(m.league.id));
    console.log(`Found ${validMatches.length} matches across tracked leagues on ${dateStr}`);
    
    if (validMatches.length === 0) continue;

    // Fetch Odds for matches on or after today
    const oddsMap = new Map();
    if (i >= 0) {
      try {
        let page = 1;
        let totalPages = 1;
        console.log(`Fetching Bet365 odds for ${dateStr}...`);
        do {
          const oddsData = await fetchWithRetry(`https://v3.football.api-sports.io/odds?date=${dateStr}&bookmaker=8&page=${page}`);
          (oddsData.response || []).forEach(odd => {
             const b365 = odd.bookmakers?.find(b => b.id === 8);
             if (b365) {
               oddsMap.set(odd.fixture.id, b365.bets);
             }
          });
          totalPages = oddsData.paging?.total || 1;
          page++;
          await new Promise(r => setTimeout(r, 500));
        } while (page <= totalPages);
      } catch (err) {
        console.error(`Error fetching odds for ${dateStr}:`, err.message);
      }
    }
    
    // UPSERT Teams
    const teamsMap = new Map();
    validMatches.forEach(m => {
      const dbLeagueId = leagueApiIdToDbId[m.league.id];
      teamsMap.set(m.teams.home.id, { ...m.teams.home, league_id: dbLeagueId });
      teamsMap.set(m.teams.away.id, { ...m.teams.away, league_id: dbLeagueId });
    });
    
    for (const [id, teamData] of teamsMap) {
      await supabase.from('teams').upsert({
        api_id: teamData.id,
        name: teamData.name,
        short_name: teamData.name?.substring(0, 3).toUpperCase(),
        logo_url: teamData.logo,
        league_id: teamData.league_id
      }, { onConflict: 'api_id' });
    }

    // Prepare Fixtures - We need the internal DB ID for teams as well
    const { data: dbTeams, error: teamErr } = await supabase
      .from('teams')
      .select('id, api_id')
      .in('api_id', Array.from(teamsMap.keys()));

    if (teamErr) {
      console.error(`Error fetching internal team IDs for ${dateStr}:`, teamErr.message);
      continue;
    }

    const teamApiIdToDbId = Object.fromEntries(dbTeams.map(t => [t.api_id, t.id]));
    
    // UPSERT Fixtures
    const fixturesToInsert = validMatches.map(m => {
       const homeDbId = teamApiIdToDbId[m.teams.home.id];
       const awayDbId = teamApiIdToDbId[m.teams.away.id];
       if (!homeDbId || !awayDbId) {
         console.warn(`Missing DB ID for teams in match ${m.fixture.id}`);
         return null;
       }
       return {
         api_id: m.fixture.id,
         league_id: leagueApiIdToDbId[m.league.id],
         home_team_id: homeDbId,
         away_team_id: awayDbId,
         date: m.fixture.date,
         status: m.fixture.status.short,
         home_score: m.goals.home,
         away_score: m.goals.away,
         ht_home_score: m.score.halftime.home,
         ht_away_score: m.score.halftime.away,
         venue: m.fixture.venue.name,
         round: m.league.round,
         season: m.league.season,
         odds: oddsMap.get(m.fixture.id) || null
       };
    }).filter(f => f !== null);
    
    const batchSize = 100;
    for (let j = 0; j < fixturesToInsert.length; j += batchSize) {
        const batch = fixturesToInsert.slice(j, j + batchSize);
        const { error } = await supabase.from('fixtures').upsert(batch, { onConflict: 'api_id' });
        if (error) console.error("Error upserting fixtures:", error);
    }
    
    console.log(`Saved ${fixturesToInsert.length} matches for ${dateStr}`);
    await new Promise(r => setTimeout(r, 1000));
  }
}

syncLobbyFixtures().then(() => console.log('Sync Complete.')).catch(console.error);
