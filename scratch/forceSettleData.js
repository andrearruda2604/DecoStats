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

async function forceSettle() {
    console.log("🛠️  Buscando estatísticas reais via FETCH...");
    
    // Pegar bilhetes dos últimos 4 dias
    const { data: tickets } = await supabase.from('odd_tickets').select('*').gte('date', '2026-04-21');
    
    if (!tickets) return;

    for (const t of tickets) {
        console.log(`\nProcessando bilhete de ${t.date}...`);
        for (const entry of t.ticket_data.entries) {
            console.log(`   - Buscando dados de ${entry.home} vs ${entry.away} (${entry.fixture_id})...`);
            
            try {
                const response = await fetch(`https://v3.football.api-sports.io/fixtures?id=${entry.fixture_id}`, {
                    headers: { 'x-apisports-key': API_KEY }
                });
                const resMatch = await response.json();
                
                if (resMatch.response?.[0]) {
                    const g = resMatch.response[0];
                    await supabase.from('fixtures').update({
                        status: g.fixture.status.short,
                        home_score: g.goals.home,
                        away_score: g.goals.away,
                        score: g.score
                    }).eq('api_id', entry.fixture_id);

                    if (g.statistics) {
                        for (const teamStats of g.statistics) {
                            const tid = teamStats.team.id;
                            for (const s of teamStats.statistics) {
                                await supabase.from('match_stats').upsert({
                                    fixture_id: entry.fixture_id,
                                    team_id: tid,
                                    type: s.type,
                                    value: s.value !== null ? String(s.value) : "0"
                                }, { onConflict: 'fixture_id,team_id,type' });
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`     Erro: ${e.message}`);
            }
        }
    }
}

forceSettle();
