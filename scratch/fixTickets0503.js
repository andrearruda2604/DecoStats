import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
const API_KEY = env.VITE_API_FOOTBALL_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchFixtureStats(fixtureId) {
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' }
  });
  const json = await resp.json();
  return json.response || [];
}

function getStatValue(teamStats, statName) {
  if (!teamStats || !teamStats.statistics) return null;
  const found = teamStats.statistics.find(s => s.type === statName);
  return found ? (parseInt(found.value) || 0) : null;
}

async function run() {
  // ── Step 1: Fetch corner stats for River Plate x Atl. Tucumán (1491948) ──
  console.log('Fetching stats for River Plate x Atletico Tucuman (1491948)...');
  const riverStats = await fetchFixtureStats(1491948);
  let riverCorners = null;
  if (riverStats.length >= 2) {
    // Home team is first in array
    riverCorners = getStatValue(riverStats[0], 'Corner Kicks');
    const awayCorners = getStatValue(riverStats[1], 'Corner Kicks');
    console.log(`River Plate corners: ${riverCorners}, Atl. Tucumán corners: ${awayCorners}`);
  } else {
    console.log('Could not fetch stats for River Plate match');
  }

  // ── Step 2: Evaluate Bilhete 2.0 ──
  console.log('\n=== BILHETE 2.0 ===');
  
  // Bologna 0x0 Cagliari → Bologna Under 2.5 Gols (Casa) → 0 < 2.5 → WON
  const bologna = { home_score: 0, away_score: 0 };
  const bolognaPick = 'UNDER 2.5 Gols Casa';
  const bolognaResult = 0 < 2.5 ? 'WON' : 'LOST';
  console.log(`Bologna 0x0 Cagliari | ${bolognaPick} | Actual: 0 | ${bolognaResult}`);

  // River Plate 0x1 Atl. Tucumán → River Over 5.5 Escanteios (Casa) → corners > 5.5 ?
  let riverResult = null;
  if (riverCorners !== null) {
    riverResult = riverCorners > 5.5 ? 'WON' : 'LOST';
    console.log(`River Plate 0x1 Atl. Tucumán | OVER 5.5 Escanteios Casa | Actual: ${riverCorners} | ${riverResult}`);
  } else {
    console.log(`River Plate 0x1 Atl. Tucumán | OVER 5.5 Escanteios Casa | Stats unavailable`);
  }

  const ticket20Won = bolognaResult === 'WON' && riverResult === 'WON';
  console.log(`\nBILHETE 2.0 STATUS: ${ticket20Won ? 'WON ✅' : (riverResult === null ? 'PENDING' : 'LOST ❌')}`);

  // ── Step 3: Evaluate Bilhete 3.0 ──
  console.log('\n=== BILHETE 3.0 ===');
  
  const games30 = [
    { home: 'Bournemouth', away: 'Crystal Palace', hs: 3, as: 0, pick: 'Bournemouth UNDER 3.5', target: 'HOME', actual: 3, threshold: 3.5, type: 'UNDER' },
    { home: 'Aston Villa', away: 'Tottenham', hs: 1, as: 2, pick: 'Tottenham UNDER 2.5', target: 'AWAY', actual: 2, threshold: 2.5, type: 'UNDER' },
    { home: 'Sassuolo', away: 'AC Milan', hs: 2, as: 0, pick: 'AC Milan UNDER 3.5', target: 'AWAY', actual: 0, threshold: 3.5, type: 'UNDER' },
    { home: 'Lyon', away: 'Rennes', hs: 4, as: 2, pick: 'Lyon OVER 0.5', target: 'HOME', actual: 4, threshold: 0.5, type: 'OVER' },
    { home: 'B. Gladbach', away: 'B. Dortmund', hs: 1, as: 0, pick: 'Dortmund OVER 0.5', target: 'AWAY', actual: 0, threshold: 0.5, type: 'OVER' },
    { home: 'FC St. Pauli', away: 'FSV Mainz 05', hs: 1, as: 2, pick: 'Mainz UNDER 2.5', target: 'AWAY', actual: 2, threshold: 2.5, type: 'UNDER' },
    { home: 'Getafe', away: 'Rayo Vallecano', hs: 0, as: 2, pick: 'Getafe UNDER 2.5', target: 'HOME', actual: 0, threshold: 2.5, type: 'UNDER' },
    { home: 'Rio Ave', away: 'Gil Vicente', hs: 0, as: 0, pick: 'Total UNDER 4.5', target: 'TOTAL', actual: 0, threshold: 4.5, type: 'UNDER' },
    { home: 'River Plate', away: 'Atl. Tucumán', hs: 0, as: 1, pick: 'Atl. Tucumán UNDER 1.5', target: 'AWAY', actual: 1, threshold: 1.5, type: 'UNDER' },
    { home: 'Rosario Central', away: 'Tigre', hs: 1, as: 1, pick: 'Rosario UNDER 2.5', target: 'HOME', actual: 1, threshold: 2.5, type: 'UNDER' },
  ];

  let ticket30Won = true;
  for (const g of games30) {
    const won = g.type === 'OVER' ? g.actual > g.threshold : g.actual < g.threshold;
    const result = won ? 'WON' : 'LOST';
    if (!won) ticket30Won = false;
    console.log(`${g.home} ${g.hs}x${g.as} ${g.away} | ${g.pick} | Actual: ${g.actual} | ${result} ${won ? '✅' : '❌'}`);
  }
  console.log(`\nBILHETE 3.0 STATUS: ${ticket30Won ? 'WON ✅' : 'LOST ❌'}`);

  // ── Step 4: Update database ──
  console.log('\n=== UPDATING DATABASE ===');

  // Fix Bilhete 2.0
  const ticket20Data = {
    entries: [
      {
        fixture_id: 1378205,
        home: "Bologna", away: "Cagliari",
        homeLogo: "https://media.api-sports.io/football/teams/500.png",
        awayLogo: "https://media.api-sports.io/football/teams/490.png",
        date_time: "2026-05-03T10:30:00+00:00",
        result: bolognaResult,
        picks: [{ market: "Gols FT (Casa)", line: "Menos de 2.5", odd: 1.20, stat: "GOLS", period: "FT", team: "Bologna", type: "UNDER", threshold: 2.5, teamTarget: "HOME", result: bolognaResult }]
      },
      {
        fixture_id: 1491948,
        home: "River Plate", away: "Atletico Tucuman",
        homeLogo: "https://media.api-sports.io/football/teams/435.png",
        awayLogo: "https://media.api-sports.io/football/teams/455.png",
        date_time: "2026-05-03T21:30:00+00:00",
        result: riverResult || 'PENDING',
        picks: [{ market: "Escanteios FT (Casa)", line: "Mais de 5.5", odd: 1.66, stat: "ESCANTEIOS", period: "FT", team: "River Plate", type: "OVER", threshold: 5.5, teamTarget: "HOME", result: riverResult || undefined }]
      }
    ]
  };

  const status20 = riverResult === null ? 'PENDING' : (ticket20Won ? 'WON' : 'LOST');
  
  const { error: err20 } = await supabase.from('odd_tickets')
    .update({ status: status20, ticket_data: ticket20Data })
    .eq('date', '2026-05-03').eq('mode', '2.0');
  console.log(`Bilhete 2.0 updated: ${status20}`, err20 || 'OK');

  // Fix Bilhete 3.0
  const correctFixtures30 = [
    { fixture_id: 1379311, home: "Bournemouth", away: "Crystal Palace", homeLogo: "https://media.api-sports.io/football/teams/35.png", awayLogo: "https://media.api-sports.io/football/teams/52.png", date_time: "2026-05-03T13:00:00+00:00" },
    { fixture_id: 1379310, home: "Aston Villa", away: "Tottenham", homeLogo: "https://media.api-sports.io/football/teams/66.png", awayLogo: "https://media.api-sports.io/football/teams/47.png", date_time: "2026-05-03T18:00:00+00:00" },
    { fixture_id: 1378212, home: "Sassuolo", away: "AC Milan", homeLogo: "https://media.api-sports.io/football/teams/488.png", awayLogo: "https://media.api-sports.io/football/teams/489.png", date_time: "2026-05-03T13:00:00+00:00" },
    { fixture_id: 1387979, home: "Lyon", away: "Rennes", homeLogo: "https://media.api-sports.io/football/teams/80.png", awayLogo: "https://media.api-sports.io/football/teams/94.png", date_time: "2026-05-03T18:45:00+00:00" },
    { fixture_id: 1388589, home: "Borussia Mönchengladbach", away: "Borussia Dortmund", homeLogo: "https://media.api-sports.io/football/teams/163.png", awayLogo: "https://media.api-sports.io/football/teams/165.png", date_time: "2026-05-03T15:30:00+00:00" },
    { fixture_id: 1388593, home: "FC St. Pauli", away: "FSV Mainz 05", homeLogo: "https://media.api-sports.io/football/teams/186.png", awayLogo: "https://media.api-sports.io/football/teams/164.png", date_time: "2026-05-03T13:30:00+00:00" },
    { fixture_id: 1391153, home: "Getafe", away: "Rayo Vallecano", homeLogo: "https://media.api-sports.io/football/teams/546.png", awayLogo: "https://media.api-sports.io/football/teams/728.png", date_time: "2026-05-03T14:15:00+00:00" },
    { fixture_id: 1396523, home: "Rio Ave", away: "GIL Vicente", homeLogo: "https://media.api-sports.io/football/teams/217.png", awayLogo: "https://media.api-sports.io/football/teams/762.png", date_time: "2026-05-03T19:30:00+00:00" },
    { fixture_id: 1491948, home: "River Plate", away: "Atletico Tucuman", homeLogo: "https://media.api-sports.io/football/teams/435.png", awayLogo: "https://media.api-sports.io/football/teams/455.png", date_time: "2026-05-03T21:30:00+00:00" },
    { fixture_id: 1491949, home: "Rosario Central", away: "Tigre", homeLogo: "https://media.api-sports.io/football/teams/437.png", awayLogo: "https://media.api-sports.io/football/teams/452.png", date_time: "2026-05-03T19:00:00+00:00" },
  ];

  const picks30 = [
    { market: "Gols FT (Casa)", line: "Menos de 3.5", odd: 1.11, stat: "GOLS", period: "FT", team: "Bournemouth", type: "UNDER", threshold: 3.5, teamTarget: "HOME" },
    { market: "Gols FT (Fora)", line: "Menos de 2.5", odd: 1.10, stat: "GOLS", period: "FT", team: "Tottenham", type: "UNDER", threshold: 2.5, teamTarget: "AWAY" },
    { market: "Gols FT (Fora)", line: "Menos de 3.5", odd: 1.10, stat: "GOLS", period: "FT", team: "AC Milan", type: "UNDER", threshold: 3.5, teamTarget: "AWAY" },
    { market: "Gols FT (Casa)", line: "Mais de 0.5", odd: 1.16, stat: "GOLS", period: "FT", team: "Lyon", type: "OVER", threshold: 0.5, teamTarget: "HOME" },
    { market: "Gols FT (Fora)", line: "Mais de 0.5", odd: 1.14, stat: "GOLS", period: "FT", team: "Borussia Dortmund", type: "OVER", threshold: 0.5, teamTarget: "AWAY" },
    { market: "Gols FT (Fora)", line: "Menos de 2.5", odd: 1.12, stat: "GOLS", period: "FT", team: "FSV Mainz 05", type: "UNDER", threshold: 2.5, teamTarget: "AWAY" },
    { market: "Gols FT (Casa)", line: "Menos de 2.5", odd: 1.12, stat: "GOLS", period: "FT", team: "Getafe", type: "UNDER", threshold: 2.5, teamTarget: "HOME" },
    { market: "Gols FT (Total)", line: "Menos de 4.5", odd: 1.11, stat: "GOLS", period: "FT", team: "Total", type: "UNDER", threshold: 4.5, teamTarget: "TOTAL" },
    { market: "Gols FT (Fora)", line: "Menos de 1.5", odd: 1.11, stat: "GOLS", period: "FT", team: "Atletico Tucuman", type: "UNDER", threshold: 1.5, teamTarget: "AWAY" },
    { market: "Gols FT (Casa)", line: "Menos de 2.5", odd: 1.10, stat: "GOLS", period: "FT", team: "Rosario Central", type: "UNDER", threshold: 2.5, teamTarget: "HOME" },
  ];

  const results30 = ['WON', 'WON', 'WON', 'WON', 'LOST', 'WON', 'WON', 'WON', 'WON', 'WON'];

  const entries30 = correctFixtures30.map((fix, i) => ({
    ...fix,
    result: results30[i],
    picks: [{ ...picks30[i], result: results30[i] }]
  }));

  const ticket30Data = { entries: entries30 };

  const { error: err30 } = await supabase.from('odd_tickets')
    .update({ status: 'LOST', ticket_data: ticket30Data })
    .eq('date', '2026-05-03').eq('mode', '3.0');
  console.log(`Bilhete 3.0 updated: LOST`, err30 || 'OK');

  console.log('\n✅ All tickets fixed!');
}

run().catch(console.error);
