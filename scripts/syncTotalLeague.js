import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 1. Load Env
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_KEY = env.VITE_API_FOOTBALL_KEY;
const targetLeague = process.argv[2]; 

if (!targetLeague) {
    console.error("Informe a ID da Liga.");
    process.exit(1);
}

const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

async function fetchWithRetry(url) {
    try {
        const resp = await fetch(url, { headers });
        const data = await resp.json();
        return data;
    } catch (e) {
        console.warn(`Erro na rede para ${url}. Tentando novamente...`);
        await new Promise(r => setTimeout(r, 2000));
        const resp = await fetch(url, { headers });
        return await resp.json();
    }
}

async function syncLeague() {
    console.log(`\n🚀 SINCRONIZAÇÃO TOTAL V4 (Resiliente) - LIGA ID: ${targetLeague}`);
    
    const { data: dbTeams } = await supabase.from('teams').select('id, api_id, name').eq('league_id', targetLeague);
    let teamsToProcess = dbTeams || [];

    if (teamsToProcess.length === 0) {
        console.log("Buscando times via fixtures...");
        const { data: fixtures } = await supabase.from('fixtures').select('home_team:home_team_id(id, name), away_team:away_team_id(id, name)').eq('league_id', targetLeague).limit(10);
        const map = new Map();
        fixtures?.forEach(f => {
            if (f.home_team) map.set(f.home_team.id, f.home_team.name);
            if (f.away_team) map.set(f.away_team.id, f.away_team.name);
        });
        teamsToProcess = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }

    console.log(`Encontrados ${teamsToProcess.length} times únicos.`);

    for (const t of teamsToProcess) {
        console.log(`\n➡️ Processando: ${t.name} (ID: ${t.id})`);
        
        const { count } = await supabase.from('teams_history').select('*', { count: 'exact', head: true }).eq('team_id', t.api_id);
        if (count >= 30) {
            console.log(`   ✅ Já possui ${count} jogos. Pulando.`);
            continue;
        }

        console.log(`   ⏳ Solicitando últimos 30 jogos na API...`);
        const fRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?team=${t.api_id}&last=30`);
        const games = (fRes.response || []).filter(g => ['FT', 'AET', 'PEN'].includes(g.fixture.status.short));

        for (const g of games) {
            try {
                const fid = g.fixture.id;
                const { data: existing } = await supabase.from('teams_history').select('id').eq('fixture_id', fid).eq('team_id', t.api_id).maybeSingle();
                if (existing) continue;

                const sRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`);
                await new Promise(r => setTimeout(r, 800)); 

                const myStatsRaw = (sRes.response || []).find(ts => ts.team.id === t.api_id);
                if (!myStatsRaw) continue;

                const isHome = g.teams.home.id === t.api_id;
                const htGoals = isHome ? (g.score.halftime.home ?? 0) : (g.score.halftime.away ?? 0);
                const ftGoals = isHome ? (g.goals.home ?? 0) : (g.goals.away ?? 0);
                
                const s1h = [...(myStatsRaw.statistics_1h || [])];
                const s2h = [...(myStatsRaw.statistics_2h || [])];
                if (!s1h.find(s => s.type === 'goals')) s1h.push({ type: 'goals', value: htGoals });
                if (!s2h.find(s => s.type === 'goals')) s2h.push({ type: 'goals', value: ftGoals - htGoals });

                const { error: insErr } = await supabase.from('teams_history').insert([{
                    fixture_id: fid, team_id: t.api_id, opponent_id: isHome ? g.teams.away.id : g.teams.home.id,
                    is_home: isHome, season: g.league.season, league_id: g.league.id, match_date: g.fixture.date,
                    goals_for: ftGoals, goals_against: isHome ? g.goals.away : g.goals.home,
                    shots_total: myStatsRaw.statistics.find(s => s.type === 'Total Shots')?.value || 0,
                    corners: myStatsRaw.statistics.find(s => s.type === 'Corner Kicks')?.value || 0,
                    stats_ft: myStatsRaw.statistics, stats_1h: s1h, stats_2h: s2h
                }]);
                
                if (insErr) console.error(`     ❌ Erro ao inserir jogo ${fid}:`, insErr.message);
                else console.log(`     ✔ Jogo ${fid} sincronizado.`);

            } catch (innerErr) {
                console.error(`     ❌ Erro inesperado no jogo:`, innerErr.message);
            }
        }
    }
    console.log(`\n🎉 PROCESSO CONCLUÍDO!`);
}

syncLeague();
