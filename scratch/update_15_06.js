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

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];
const API_KEY = env['VITE_API_FOOTBALL_KEY'] || env['API_FOOTBALL_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function fetchWithRetry(url) {
  let retries = 3;
  while (retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      return data;
    } catch (err) {
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if (retries === 0) throw err;
    }
  }
}

async function update() {
  const fids = [1520723, 1520727]; // Criciuma x Ceara, Londrina x Avai
  
  for (const fid of fids) {
    console.log(`Buscando dados da partida ${fid}...`);
    const data = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?id=${fid}`);
    const m = data.response?.[0];
    
    if (m) {
      // Update fixture
      const { error: fixError } = await supabase.from('fixtures').update({
        status: m.fixture.status.short,
        home_score: m.goals.home,
        away_score: m.goals.away,
        ht_home_score: m.score.halftime.home,
        ht_away_score: m.score.halftime.away
      }).eq('api_id', fid);
      
      if (fixError) console.error(`Erro fixture ${fid}:`, fixError.message);
      else console.log(`✓ Fixture atualizada: ${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`);
      
      // Update stats if needed - but reevaluate_june.js uses teams_history
      const statsRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`);
      const statsData = statsRes.response || [];
      
      for (const teamId of [m.teams.home.id, m.teams.away.id]) {
        const isHome = teamId === m.teams.home.id;
        const myStats = statsData.find(s => s.team.id === teamId);
        
        if (myStats) {
            // Upsert into teams_history
            const record = {
                fixture_id: fid,
                team_id: teamId,
                is_home: isHome,
                season: m.league.season,
                league_id: m.league.id,
                goals_for: isHome ? m.goals.home : m.goals.away,
                goals_against: isHome ? m.goals.away : m.goals.home,
                stats_ft: myStats.statistics || [],
                stats_1h: myStats.statistics_1h || [],
                stats_2h: myStats.statistics_2h || [],
            };
            
            // extract some fields just in case
            const getStat = (arr, type) => {
              const s = arr?.find(x => x.type === type);
              return s?.value ? parseInt(s.value) : 0;
            };
            
            record.corners = getStat(myStats.statistics, 'Corner Kicks');
            record.yellow_cards = getStat(myStats.statistics, 'Yellow Cards');
            record.shots_on_goal = getStat(myStats.statistics, 'Shots on Goal');
            
            const { error } = await supabase.from('teams_history').upsert(record, { onConflict: 'fixture_id,team_id' });
            if (error) console.error(`Erro stats ${teamId}:`, error.message);
            else console.log(`✓ Stats atualizadas: team ${teamId}`);
        }
      }
    }
  }
}

update().catch(console.error);
