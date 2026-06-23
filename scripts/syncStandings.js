/**
 * syncStandings.js
 * Fetches league standings from API-Football and upserts into the `standings` table.
 * Run daily via masterDaily.js or manually: node scripts/syncStandings.js
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const API_KEY      = process.env.VITE_API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase credentials'); process.exit(1); }
if (!API_KEY) { console.error('Missing API_FOOTBALL_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io',
};

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      if (data.errors && Object.keys(data.errors).length > 0) throw new Error(JSON.stringify(data.errors));
      return data;
    } catch (err) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
      else throw err;
    }
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function syncStandings() {
  console.log('=== Sincronizando Classificações ===\n');

  const { data: leagues, error } = await supabase
    .from('leagues')
    .select('id, api_id, season, name')
    .eq('is_active', true);

  if (error || !leagues?.length) {
    console.error('Erro ao buscar ligas:', error);
    return;
  }

  console.log(`Ligas ativas: ${leagues.length}\n`);

  let ok = 0, skipped = 0, failed = 0;

  for (const league of leagues) {
    try {
      const url = `https://v3.football.api-sports.io/standings?league=${league.api_id}&season=${league.season}`;
      const data = await fetchWithRetry(url);

      if (!data.response || data.response.length === 0) {
        console.log(`  ⚠ ${league.name}: sem dados de classificação`);
        skipped++;
        await sleep(300);
        continue;
      }

      const rows = [];
      for (const item of data.response) {
        const leagueStandings = item.league?.standings;
        if (!leagueStandings) continue;

        for (const group of leagueStandings) {
          for (const entry of group) {
            // Skip generic "Group Stage" aggregate rows (e.g. World Cup)
            if (entry.group === 'Group Stage') continue;

            rows.push({
              league_id:     league.id,
              season:        league.season,
              group:         entry.group || '',
              rank:          entry.rank,
              team_api_id:   entry.team.id,
              team_name:     entry.team.name,
              team_logo:     entry.team.logo || '',
              points:        entry.points,
              played:        entry.all.played,
              won:           entry.all.win,
              drawn:         entry.all.draw,
              lost:          entry.all.lose,
              goals_for:     entry.all.goals.for,
              goals_against: entry.all.goals.against,
              goal_diff:     entry.goalsDiff,
              form:          entry.form || '',
              updated_at:    new Date().toISOString(),
            });
          }
        }
      }

      // Replace API-Sports logos with migrated Supabase Storage logos when available
      if (rows.length > 0) {
        const teamApiIds = [...new Set(rows.map(r => r.team_api_id))];
        const { data: dbTeams } = await supabase
          .from('teams')
          .select('api_id, logo_url')
          .in('api_id', teamApiIds);

        if (dbTeams?.length) {
          const logoMap = Object.fromEntries(dbTeams.map(t => [t.api_id, t.logo_url]));
          for (const row of rows) {
            const migrated = logoMap[row.team_api_id];
            if (migrated && !migrated.includes('api-sports')) {
              row.team_logo = migrated;
            }
          }
        }
      }

      if (rows.length === 0) {
        console.log(`  ⚠ ${league.name}: nenhuma linha encontrada`);
        skipped++;
        await sleep(300);
        continue;
      }

      // Delete existing rows and re-insert (clean slate)
      await supabase.from('standings').delete()
        .eq('league_id', league.id)
        .eq('season', league.season);

      const { error: insertErr } = await supabase.from('standings').insert(rows);

      if (insertErr) {
        console.error(`  ✗ ${league.name}: ${insertErr.message}`);
        failed++;
      } else {
        console.log(`  ✓ ${league.name}: ${rows.length} times`);
        ok++;
      }

      await sleep(300); // respect API rate limits
    } catch (err) {
      console.error(`  ✗ ${league.name}: ${err.message}`);
      failed++;
      await sleep(500);
    }
  }

  console.log(`\n=== Resultado: ${ok} OK · ${skipped} sem dados · ${failed} erros ===`);
}

syncStandings().catch(console.error);
