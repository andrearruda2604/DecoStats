/**
 * Backfill direcionado: Arsenal home games PL 2025 ausentes do teams_history
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const headers = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function fetchApi(url) {
  const r = await fetch(url, { headers });
  return r.json();
}
const delay = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  // 1. Encontra todos os jogos em casa do Arsenal na PL 2025 que faltam
  const { data: fixes } = await sb.from('fixtures')
    .select('api_id, date, season, league_id, home_score, away_score, ht_home_score, ht_away_score, home_team:teams!fixtures_home_team_id_fkey(id,api_id), away_team:teams!fixtures_away_team_id_fkey(id,api_id)')
    .eq('home_team_id', 42)   // Arsenal teams.id = api_id = 42
    .eq('league_id', 39)
    .eq('season', 2025)
    .in('status', ['FT', 'AET', 'PEN'])
    .order('date');

  const { data: hist } = await sb.from('teams_history').select('fixture_id').eq('team_id', 42).eq('league_id', 39).eq('is_home', true);
  const existing = new Set(hist?.map(h => h.fixture_id));
  const missing = (fixes || []).filter(f => !existing.has(f.api_id));

  console.log(`Arsenal home: ${fixes?.length} FT | já no banco: ${existing.size} | faltando: ${missing.length}`);

  if (!missing.length) { console.log('Nada a fazer.'); return; }

  const extractStat = (arr, type) => {
    const s = (arr || []).find(s => s.type === type);
    if (!s || s.value === null) return 0;
    if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value);
    return parseInt(s.value) || 0;
  };

  for (const f of missing) {
    console.log(`\n→ Fixture ${f.api_id} (${f.date?.slice(0, 10)}) Arsenal ${f.home_score}-${f.away_score}`);

    const sRes = await fetchApi(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${f.api_id}&half=true`);
    await delay(1300);

    if (!sRes.response?.length) { console.log('  ⚠️  Sem stats na API'); continue; }

    for (const side of ['home', 'away']) {
      const isHome   = side === 'home';
      const teamObj  = isHome ? f.home_team : f.away_team;
      const apiId    = teamObj.api_id;
      const goalsFor = isHome ? f.home_score : f.away_score;
      const goalsAg  = isHome ? f.away_score : f.home_score;

      const raw = sRes.response.find(ts => ts.team.id === apiId);
      if (!raw) { console.log(`  ⚠️  Sem stats para time ${apiId}`); continue; }

      const record = {
        fixture_id:        f.api_id,
        team_id:           apiId,
        opponent_id:       (isHome ? f.away_team : f.home_team).api_id,
        is_home:           isHome,
        season:            f.season,
        league_id:         f.league_id,
        match_date:        f.date,
        goals_for:         goalsFor,
        goals_against:     goalsAg,
        shots_total:       extractStat(raw.statistics, 'Total Shots'),
        shots_on_goal:     extractStat(raw.statistics, 'Shots on Goal'),
        corners:           extractStat(raw.statistics, 'Corner Kicks'),
        yellow_cards:      extractStat(raw.statistics, 'Yellow Cards'),
        red_cards:         extractStat(raw.statistics, 'Red Cards'),
        possession:        extractStat(raw.statistics, 'Ball Possession'),
        fouls:             extractStat(raw.statistics, 'Fouls'),
        offsides:          extractStat(raw.statistics, 'Offsides'),
        goalkeeper_saves:  extractStat(raw.statistics, 'Goalkeeper Saves'),
        passes_accurate:   extractStat(raw.statistics, 'Passes accurate'),
        stats_ft:          raw.statistics  || [],
        stats_1h:          raw.statistics_1h || [],
        stats_2h:          raw.statistics_2h || [],
      };

      const { error } = await sb.from('teams_history').upsert([record], { onConflict: 'fixture_id,team_id' });
      if (error) console.error(`  ❌ ${side}:`, error.message);
      else console.log(`  ✓ ${side} (team ${apiId}): ${goalsFor}-${goalsAg}`);
    }
  }

  console.log('\nConferindo resultado...');
  const { data: after } = await sb.from('teams_history').select('fixture_id').eq('team_id', 42).eq('league_id', 39).eq('is_home', true);
  console.log(`Arsenal home no teams_history: ${after?.length} (era ${existing.size})`);
}

run().catch(console.error);
