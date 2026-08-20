import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function getTimezoneOffset() {
  // Always force Brazilian timezone (-03:00) so that "today" correctly matches BRT days,
  // regardless of the machine/server running the script (e.g., GitHub Actions in UTC).
  return "-03:00";
}

const CRITERIA = [
  { id: 'goals', label: 'Gols', flatKey: 'goals_for' },
  { id: 'corners', label: 'Escanteios', flatKey: 'corners' },
  { id: 'cards', label: 'Cartões', flatKey: 'cards' }, // custom calculation: yellow + red
  { id: 'shots_target', label: 'Chutes no Gol', flatKey: 'shots_on_goal' },
  { id: 'shots_total', label: 'Chutes Totais', flatKey: 'shots_total' }
];

async function generateTops(targetDateStr) {
  try {
    const targetDate = targetDateStr || new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
    const offset = getTimezoneOffset();
    
    console.log(`[generateTops] Generating Tops for date: ${targetDate}`);

    const { data: matches, error: mErr } = await supabase
      .from('fixtures')
      .select(`
        id, api_id, date, status, home_score, away_score, round,
        league:leagues!fixtures_league_id_fkey(id, name, country, country_code, flag_url, logo_url, season),
        home_team:teams!fixtures_home_team_id_fkey(id, api_id, name, logo_url),
        away_team:teams!fixtures_away_team_id_fkey(id, api_id, name, logo_url)
      `)
      .gte('date', `${targetDate}T00:00:00${offset}`)
      .lte('date', `${targetDate}T23:59:59${offset}`)
      .order('date', { ascending: true });

    if (mErr) throw mErr;

    if (!matches || matches.length === 0) {
      console.log(`[generateTops] No matches found for ${targetDate}. Exiting.`);
      return;
    }

    const tMap = new Map();
    const teamIds = new Set();

    matches.forEach(m => {
      if (!m.league || !m.home_team || !m.away_team) return;
      teamIds.add(m.home_team.api_id);
      teamIds.add(m.away_team.api_id);
      tMap.set(m.home_team.api_id, { name: m.home_team.name, logoUrl: m.home_team.logo_url, fixtureId: m.id, isHome: true, season: m.league.season, leagueId: m.league.id });
      tMap.set(m.away_team.api_id, { name: m.away_team.name, logoUrl: m.away_team.logo_url, fixtureId: m.id, isHome: false, season: m.league.season, leagueId: m.league.id });
    });

    const allTeamIds = Array.from(teamIds);
    if (allTeamIds.length === 0) {
      console.log(`[generateTops] No valid teams found. Exiting.`);
      return;
    }

    console.log(`[generateTops] Fetching history for ${allTeamIds.length} teams...`);
    let history = [];
    for (let i = 0; i < allTeamIds.length; i += 10) {
      const batchIds = allTeamIds.slice(i, i + 10);
      const { data: historyBatch, error: hErr } = await supabase
        .from('teams_history')
        .select('team_id, season, league_id, is_home, match_date, goals_for, corners, yellow_cards, red_cards, shots_total, shots_on_goal')
        .in('team_id', batchIds)
        .order('match_date', { ascending: false });
      if (hErr) throw hErr;
      if (historyBatch) history.push(...historyBatch);
    }

    const historyByTeam = new Map();
    (history || []).forEach(row => {
      if (!historyByTeam.has(row.team_id)) historyByTeam.set(row.team_id, []);
      historyByTeam.get(row.team_id).push(row);
    });

    const computedData = { goals: [], corners: [], cards: [], shots_target: [], shots_total: [] };

    allTeamIds.forEach(teamId => {
      const teamInfo = tMap.get(teamId);
      if (!teamInfo) return;

      let th = historyByTeam.get(teamId) || [];

      // Regra de criação de bilhetes: considera campeonato, mando, e mínimo de jogos
      if (teamInfo.isHome) {
        th = th.filter(h => h.is_home && h.season === teamInfo.season && h.league_id === teamInfo.leagueId);
      } else {
        th = th.filter(h => !h.is_home && h.season === teamInfo.season && h.league_id === teamInfo.leagueId);
      }

      // Take last 20 matching games
      const filtered = th.slice(0, 20);
      // Require at least 7 games to be considered in the ranking
      if (filtered.length < 7) return;

      CRITERIA.forEach(crit => {
        let sum = 0;
        let validCount = 0;

        filtered.forEach(h => {
          let val = 0;
          if (crit.id === 'cards') {
            val = (h.yellow_cards || 0) + (h.red_cards || 0);
          } else {
            val = (h[crit.flatKey] || 0);
          }
          sum += val;
          validCount++;
        });

        if (validCount > 0) {
          computedData[crit.id].push({
            teamId,
            teamName: teamInfo.name,
            teamLogo: teamInfo.logoUrl,
            fixtureId: teamInfo.fixtureId,
            isHome: teamInfo.isHome,
            value: sum / validCount
          });
        }
      });
    });

    // Sort each criteria descending and keep top 10
    CRITERIA.forEach(crit => {
      computedData[crit.id].sort((a, b) => b.value - a.value);
      computedData[crit.id] = computedData[crit.id].slice(0, 10);
    });

    console.log(`[generateTops] Saving Tops data to odd_tickets (mode: tops) for date: ${targetDate}...`);
    
    // Check if entry exists
    const { data: existing } = await supabase
      .from('odd_tickets')
      .select('date')
      .eq('date', targetDate)
      .eq('mode', 'tops')
      .single();

    const newTicketData = {
      tops: computedData,
      generated_at: new Date().toISOString()
    };

    if (existing) {
      await supabase
        .from('odd_tickets')
        .update({ ticket_data: newTicketData })
        .eq('date', targetDate)
        .eq('mode', 'tops');
      console.log(`[generateTops] Updated existing Tops entry.`);
    } else {
      await supabase
        .from('odd_tickets')
        .insert({
          date: targetDate,
          mode: 'tops',
          status: 'COMPLETED',
          total_odd: 0,
          matches_count: 0,
          ticket_data: newTicketData
        });
      console.log(`[generateTops] Created new Tops entry.`);
    }

  } catch (error) {
    console.error(`[generateTops] Error:`, error);
  }
}

const arg = process.argv[2];
generateTops(arg).then(() => process.exit(0));
