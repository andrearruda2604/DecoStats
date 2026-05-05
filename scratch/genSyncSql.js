import fs from 'fs';

let env = {};
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

const API_KEY = env.VITE_API_FOOTBALL_KEY;

async function syncResults(dateStr) {
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  const json = await resp.json();
  const matches = json.response || [];

  const targetIds = [1378207, 1378211, 1379313, 1379314, 1391156, 1396524];
  
  let sql = "";

  for (const m of matches) {
    if (!targetIds.includes(m.fixture.id)) continue;

    const isFT = ['FT', 'AET', 'PEN'].includes(m.fixture.status.short);
    
    sql += `UPDATE fixtures SET status = '${m.fixture.status.short}', home_score = ${m.goals.home}, away_score = ${m.goals.away}, ht_home_score = ${m.score.halftime.home}, ht_away_score = ${m.score.halftime.away}, score = '${JSON.stringify(m.score)}'::jsonb WHERE api_id = ${m.fixture.id};\n`;

    if (isFT) {
      const statsResp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${m.fixture.id}`, {
        headers: { 'x-apisports-key': API_KEY }
      });
      const statsJson = await statsResp.json();
      const stats = statsJson.response || [];

      for (const s of stats) {
        const isHome = s.team.id === m.teams.home.id;
        const corners = s.statistics.find(st => st.type === 'Corner Kicks')?.value || 0;
        const yellow = s.statistics.find(st => st.type === 'Yellow Cards')?.value || 0;
        const red = s.statistics.find(st => st.type === 'Red Cards')?.value || 0;

        sql += `INSERT INTO teams_history (fixture_id, team_id, league_id, season, match_date, is_home, goals_for, goals_against, corners, yellow_cards, red_cards, stats_ft) 
                VALUES (${m.fixture.id}, ${s.team.id}, ${m.league.id}, ${m.league.season}, '${m.fixture.date}', ${isHome}, ${isHome ? m.goals.home : m.goals.away}, ${isHome ? m.goals.away : m.goals.home}, ${corners}, ${yellow}, ${red}, '${JSON.stringify(s.statistics)}'::jsonb) 
                ON CONFLICT (fixture_id, team_id) DO UPDATE SET corners = EXCLUDED.corners, yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards, stats_ft = EXCLUDED.stats_ft;\n`;
      }
    }
  }
  console.log(sql);
}

syncResults('2026-05-04').catch(console.error);
