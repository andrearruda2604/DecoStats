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

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function syncLive() {
    console.log("📡 Iniciando Sincronização ao Vivo (Live Scores)...");
    
    // 1. Buscar no banco quais jogos estão em bilhetes ativos ou marcados como 'LIVE/1H/2H/HT'
    const { data: fixtures } = await supabase
        .from('fixtures')
        .select('*')
        .in('status', ['1H', '2H', 'HT', 'LIVE', 'NS']); // Inclui NS para pegar o início do jogo

    if (!fixtures || fixtures.length === 0) {
        console.log("Nenhum jogo ativo no momento para sincronizar.");
        return;
    }

    const liveIds = fixtures.map(f => f.api_id).join('-');

    try {
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${liveIds}`, {
            headers: { 'x-apisports-key': API_KEY }
        });
        const data = await response.json();

        if (data.response) {
            for (const g of data.response) {
                console.log(`⚽ Atualizando: ${g.teams.home.name} ${g.goals.home}x${g.goals.away} ${g.teams.away.name} (${g.fixture.status.short})`);
                
                // Atualizar placar e status
                await supabase.from('fixtures').update({
                    status: g.fixture.status.short,
                    goals_home: g.goals.home,
                    goals_away: g.goals.away,
                    score: g.score
                }).eq('api_id', g.fixture.id);

                // Atualizar estatísticas ao vivo (para o "FEZ: X")
                if (g.statistics) {
                    for (const teamStats of g.statistics) {
                        for (const s of teamStats.statistics) {
                            if (['Corner Kicks', 'Yellow Cards', 'Total Shots'].includes(s.type)) {
                                await supabase.from('match_stats').upsert({
                                    fixture_id: g.fixture.id,
                                    team_id: teamStats.team.id,
                                    type: s.type,
                                    value: s.value !== null ? String(s.value) : "0"
                                }, { onConflict: 'fixture_id,team_id,type' });
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Erro no Sync Live:", e.message);
    }
}

syncLive();
