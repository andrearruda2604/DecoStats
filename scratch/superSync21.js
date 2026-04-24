import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { execSync } from 'child_process';

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

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function superSync() {
    console.log("🌍 Buscando jogos de TODAS as ligas principais para o dia 21...");
    const date = '2026-04-21';
    
    // Principais Ligas do Mundo
    const leagues = [39, 140, 135, 78, 61, 71]; 
    
    for (const lid of leagues) {
        console.log(`🔍 Sincronizando Liga ${lid}...`);
        try {
            const res = await axios.get(`https://v3.football.api-sports.io/fixtures?date=${date}&league=${lid}`, {
                headers: { 'x-apisports-key': API_KEY }
            });

            const games = res.data.response;
            console.log(`   - Encontrados ${games.length} jogos.`);

            for (const g of games) {
                const fixture = {
                    api_id: g.fixture.id,
                    fixture_id: g.fixture.id,
                    date: g.fixture.date,
                    status: g.fixture.status.short,
                    league_id: g.league.id,
                    home_team_id: g.teams.home.id,
                    away_team_id: g.teams.away.id,
                    goals_home: g.goals.home,
                    goals_away: g.goals.away,
                    score: g.score
                };

                await supabase.from('fixtures').upsert(fixture, { onConflict: 'api_id' });
            }
        } catch (e) {
            console.log(`Erro na liga ${lid}: ${e.message}`);
        }
    }

    console.log("🚀 Sincronização concluída! Regerando bilhete matemático...");
    execSync(`node scripts/generateOdd2.js ${date}`);
    execSync(`node scripts/settleTickets.js`);
    console.log("✅ Dia 21 reconstruído com base global!");
}

superSync();
