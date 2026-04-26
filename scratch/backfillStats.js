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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
const API_KEY = env.VITE_API_FOOTBALL_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function backfillStats(leagueApiId = 71, season = 2026) {
    console.log(`🚀 Iniciando recuperação de estatísticas para Liga ${leagueApiId}, Temporada ${season}...`);

    // 1. Pegar todos os jogos finalizados desta liga que estão sem estatísticas
    const { data: fixtures } = await supabase
        .from('fixtures')
        .select(`
            id, 
            api_id, 
            home_team_id, 
            away_team_id, 
            home_score, 
            away_score,
            teams_home:home_team_id(api_id, name),
            teams_away:away_team_id(api_id, name)
        `)
        .eq('status', 'FT')
        .eq('season', season)
        .order('date', { ascending: false });

    if (!fixtures || fixtures.length === 0) {
        console.log("Nenhum jogo finalizado encontrado para processar.");
        return;
    }

    console.log(`Encontrados ${fixtures.length} jogos para verificar estatísticas.`);

    for (const f of fixtures) {
        // Verificar se já tem stats (para não gastar API a toa)
        const { count } = await supabase
            .from('fixture_stats')
            .select('*', { count: 'exact', head: true })
            .eq('fixture_id', f.id);

        if (count > 0) {
            console.log(`⏩ Jogo ${f.api_id} (${f.teams_home.name} vs ${f.teams_away.name}) já possui estatísticas.`);
            continue;
        }

        console.log(`📊 Buscando estatísticas para: ${f.teams_home.name} vs ${f.teams_away.name} (ID: ${f.api_id})`);
        
        try {
            const resp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${f.api_id}`, {
                headers: { 'x-apisports-key': API_KEY }
            });
            const json = await resp.json();
            const statsApi = json.response;

            if (statsApi && statsApi.length > 0) {
                for (const teamStats of statsApi) {
                    const isHome = teamStats.team.id === f.teams_home.api_id;
                    const dbTeamId = isHome ? f.home_team_id : f.away_team_id;
                    
                    const statsMap = {};
                    teamStats.statistics.forEach(s => { statsMap[s.type] = s.value; });

                    const parseStat = (val) => {
                        if (val === null) return 0;
                        if (typeof val === 'string' && val.includes('%')) return parseFloat(val.replace('%', ''));
                        return Number(val) || 0;
                    };

                    const statRow = {
                        fixture_id: f.id,
                        team_id: dbTeamId,
                        period: 'FT',
                        shots_total: parseStat(statsMap['Total Shots']),
                        shots_on_goal: parseStat(statsMap['Shots on Goal']),
                        shots_off_goal: parseStat(statsMap['Shots off Goal']),
                        corners: parseStat(statsMap['Corner Kicks']),
                        yellow_cards: parseStat(statsMap['Yellow Cards']),
                        red_cards: parseStat(statsMap['Red Cards']),
                        goals: parseStat(isHome ? f.home_score : f.away_score),
                        possession: parseStat(statsMap['Ball Possession']),
                        fouls: parseStat(statsMap['Fouls']),
                        offsides: parseStat(statsMap['Offsides'])
                    };

                    const { error: insertError } = await supabase.from('fixture_stats').insert([statRow]);
                    if (insertError) {
                        console.error(`❌ Erro ao salvar stats do jogo ${f.api_id}:`, insertError.message);
                    } else {
                        console.log(`✅ Estatísticas salvas para o jogo ${f.api_id}`);
                    }
                }
            }
            
            // Pequeno delay para não estourar o rate limit da API
            await new Promise(r => setTimeout(r, 1000));

        } catch (e) {
            console.error(`❌ Erro no processamento do jogo ${f.api_id}:`, e.message);
        }
    }

    console.log("🏁 Carga histórica concluída!");
}

// Rodar para o Brasileirão 2026
backfillStats(71, 2026);
