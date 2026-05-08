import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load Env (process.env first, fallback to .env.local)
let env = { ...process.env };
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!env[match[1].trim()]) env[match[1].trim()] = val;
    }
  });
} catch (_) {}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
const API_KEY      = env.VITE_API_FOOTBALL_KEY || env.API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase credentials'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
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

async function syncMissing() {
    console.log(`\n🔍 Buscando partidas finalizadas sem histórico nas últimas 2 semanas...`);
    
    const { data: missing, error: fetchErr } = await supabase.rpc('get_missing_history_fixtures');
    
    // If RPC doesn't exist, use raw query
    let missingFixtures = [];
    const { data, error } = await supabase.from('fixtures')
        .select('api_id, home_team_id, away_team_id, league_id, season, date')
        .eq('status', 'FT')
        .gt('date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });

    if (error) {
        console.error("Erro ao buscar fixtures:", error);
        return;
    }

    // Filter those already in teams_history using a more reliable check
    // We'll check in batches of 100 to avoid long IN clauses or truncation
    for (let i = 0; i < data.length; i += 100) {
        const batch = data.slice(i, i + 100);
        const batchIds = batch.map(f => f.api_id);
        
        const { data: existing } = await supabase.from('teams_history')
            .select('fixture_id')
            .in('fixture_id', batchIds);
            
        const existingIds = new Set(existing?.map(e => e.fixture_id) || []);
        missingFixtures.push(...batch.filter(f => !existingIds.has(f.api_id)));
    }

    console.log(`Encontradas ${missingFixtures.length} partidas para sincronizar stats.`);

    for (const f of missingFixtures) {
        const fid = f.api_id;
        console.log(`\n➡️ Partida ${fid} (${f.date})`);
        
        try {
            const sRes = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`);
            await new Promise(r => setTimeout(r, 1200)); 

            const { data: fixDetail } = await supabase.from('fixtures').select('home_score, away_score, ht_home_score, ht_away_score, home_team:home_team_id(api_id), away_team:away_team_id(api_id)').eq('api_id', fid).single();

            for (const teamSide of ['home', 'away']) {
                const teamData = teamSide === 'home' ? fixDetail.home_team : fixDetail.away_team;
                const oppData = teamSide === 'home' ? fixDetail.away_team : fixDetail.home_team;
                
                const teamApiId = teamData.api_id;
                const oppApiId = oppData.api_id;
                
                const myStatsRaw = (sRes.response || []).find(ts => ts.team.id === teamApiId);
                if (!myStatsRaw) {
                    console.log(`   ⚠️ Sem stats para time ${teamApiId}`);
                    continue;
                }

                const isHome = teamSide === 'home';
                const goalsFor = isHome ? fixDetail.home_score : fixDetail.away_score;
                const goalsAgainst = isHome ? fixDetail.away_score : fixDetail.home_score;
                const htGoals = isHome ? (fixDetail.ht_home_score || 0) : (fixDetail.ht_away_score || 0);

                const extractStat = (arr, type) => {
                    const s = (arr || []).find(s => s.type === type);
                    if (!s || s.value === null) return 0;
                    if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
                    return parseInt(s.value) || 0;
                };

                const record = {
                    fixture_id: fid,
                    team_id: teamApiId,
                    opponent_id: oppApiId,
                    is_home: isHome,
                    season: f.season,
                    league_id: f.league_id,
                    match_date: f.date,
                    goals_for: goalsFor,
                    goals_against: goalsAgainst,
                    shots_total: extractStat(myStatsRaw.statistics, 'Total Shots'),
                    shots_on_goal: extractStat(myStatsRaw.statistics, 'Shots on Goal'),
                    corners: extractStat(myStatsRaw.statistics, 'Corner Kicks'),
                    yellow_cards: extractStat(myStatsRaw.statistics, 'Yellow Cards'),
                    red_cards: extractStat(myStatsRaw.statistics, 'Red Cards'),
                    possession: extractStat(myStatsRaw.statistics, 'Ball Possession'),
                    fouls: extractStat(myStatsRaw.statistics, 'Fouls'),
                    offsides: extractStat(myStatsRaw.statistics, 'Offsides'),
                    goalkeeper_saves: extractStat(myStatsRaw.statistics, 'Goalkeeper Saves'),
                    passes_accurate: extractStat(myStatsRaw.statistics, 'Passes accurate'),
                    stats_ft: myStatsRaw.statistics || [],
                    stats_1h: myStatsRaw.statistics_1h || [],
                    stats_2h: myStatsRaw.statistics_2h || [],
                };

                const { error: insErr } = await supabase.from('teams_history').insert([record]);
                if (insErr) console.error(`   ❌ Erro time ${teamApiId}:`, insErr.message);
                else console.log(`   ✓ Time ${teamApiId} sincronizado.`);
            }
        } catch (err) {
            console.error(`   ❌ Erro inesperado:`, err.message);
        }
    }
    console.log(`\n🎉 PROCESSO CONCLUÍDO!`);
}

syncMissing().catch(console.error);
