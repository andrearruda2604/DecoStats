/**
 * Análise: Aston Villa (Casa, api_id=66) vs Liverpool (Fora, api_id=40)
 * Fixture 1379330, Premier League (league_id=39), season 2025
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) { let v = match[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); env[match[1].trim()] = v; }
  });
} catch(e) {}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };
const BOOKMAKER_ID = 8;
const FIXTURE_API_ID = 1379330;
const LEAGUE_DB_ID   = 39;
const SEASON         = 2025;
const AV_API_ID      = 66;
const LIV_API_ID     = 40;
const MIN_GAMES      = 5;

async function fetchApi(url) {
  const r = await fetch(url, { headers: API_HEADERS });
  const d = await r.json();
  return d.response || [];
}

// Históricos
const { data: homeHist } = await sb.from('teams_history').select('*').eq('team_id', AV_API_ID).eq('season', SEASON).eq('league_id', LEAGUE_DB_ID).eq('is_home', true);
const { data: awayHist } = await sb.from('teams_history').select('*').eq('team_id', LIV_API_ID).eq('season', SEASON).eq('league_id', LEAGUE_DB_ID).eq('is_home', false);

console.log(`Aston Villa em casa: ${homeHist?.length} jogos`);
console.log(`Liverpool fora: ${awayHist?.length} jogos`);

// matchTotals (soma de ambas equipes por fixture)
const allFixIds = [...new Set([...(homeHist||[]), ...(awayHist||[])].map(h => h.fixture_id))];
const matchTotals = {};
if (allFixIds.length) {
  const { data: totRows } = await sb.from('teams_history')
    .select('fixture_id, corners, shots_on_goal, stats_ft, stats_1h')
    .in('fixture_id', allFixIds);
  for (const row of (totRows || [])) {
    if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, cards: 0, shots_on_goal: 0, sog_count: 0 };
    const t = matchTotals[row.fixture_id];
    t.corners += (row.corners || 0);
    const y = parseInt(row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0);
    const r = parseInt(row.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0);
    t.cards += y + r;
    if (row.shots_on_goal != null) { t.shots_on_goal += row.shots_on_goal; t.sog_count++; }
  }
}

function evalStat(games, matchTotals, stat, teamTarget, type, threshold) {
  let hits = 0, valid = 0;
  for (const m of games) {
    let val = null;
    if (stat === 'GOLS') {
      if (teamTarget === 'TOTAL') val = (m.goals_for || 0) + (m.goals_against || 0);
      else if (teamTarget === 'HOME') val = m.is_home ? (m.goals_for || 0) : (m.goals_against || 0);
      else val = m.is_home ? (m.goals_against || 0) : (m.goals_for || 0);
    } else if (stat === 'ESCANTEIOS') {
      if (teamTarget === 'TOTAL') { const t = matchTotals[m.fixture_id]; if (t?.corners != null) val = t.corners; }
      else if (m.corners != null) val = m.corners;
    } else if (stat === 'CARTÕES') {
      if (teamTarget === 'TOTAL') { const t = matchTotals[m.fixture_id]; if (t?.cards != null) val = t.cards; }
      else {
        const y = m.stats_ft?.find(s => s.type === 'Yellow Cards');
        const r = m.stats_ft?.find(s => s.type === 'Red Cards');
        if (y || r) val = (parseInt(y?.value)||0) + (parseInt(r?.value)||0);
      }
    } else if (stat === 'BTTS') {
      val = (m.goals_for || 0) > 0 && (m.goals_against || 0) > 0 ? 1 : 0;
      hits += (val === 1) ? 1 : 0; valid++; continue;
    }
    if (val != null) {
      valid++;
      if (type === 'OVER' && val > threshold) hits++;
      if (type === 'UNDER' && val < threshold) hits++;
    }
  }
  if (valid < MIN_GAMES) return null;
  return { pct: (hits/valid)*100, hits, total: valid };
}

const allGames = [...(homeHist||[]), ...(awayHist||[])];

// Dados brutos
console.log('\n--- AV Casa ---');
console.log('Gols marcados:', (homeHist||[]).map(m => m.goals_for));
console.log('Gols sofridos:', (homeHist||[]).map(m => m.goals_against));
console.log('Escanteios:', (homeHist||[]).map(m => m.corners));
console.log('Cartões:', (homeHist||[]).map(m => {
  const y=m.stats_ft?.find(s=>s.type==='Yellow Cards')?.value||0;
  const r=m.stats_ft?.find(s=>s.type==='Red Cards')?.value||0;
  return (parseInt(y))+(parseInt(r));
}));

console.log('\n--- Liverpool Fora ---');
console.log('Gols marcados:', (awayHist||[]).map(m => m.goals_for));
console.log('Gols sofridos:', (awayHist||[]).map(m => m.goals_against));
console.log('Escanteios:', (awayHist||[]).map(m => m.corners));

// Total corners dos jogos do AV em casa
console.log('\nTotal corners (ambas equipes) — jogos AV em casa:');
(homeHist||[]).forEach((m,i) => {
  const tot = matchTotals[m.fixture_id];
  console.log(`  Jogo ${i+1}: AV=${m.corners} total=${tot?.corners} cards=${tot?.cards}`);
});
console.log('\nTotal corners (ambas equipes) — jogos LIV fora:');
(awayHist||[]).forEach((m,i) => {
  const tot = matchTotals[m.fixture_id];
  console.log(`  Jogo ${i+1}: LIV=${m.corners} total=${tot?.corners} cards=${tot?.cards}`);
});

// Probabilidades
const checks = [
  { label: 'Total Gols >1.5', stat:'GOLS', target:'TOTAL', type:'OVER', thr:1.5, games: allGames },
  { label: 'Total Gols >2.5', stat:'GOLS', target:'TOTAL', type:'OVER', thr:2.5, games: allGames },
  { label: 'Total Gols >3.5', stat:'GOLS', target:'TOTAL', type:'OVER', thr:3.5, games: allGames },
  { label: 'Total Gols <4.5', stat:'GOLS', target:'TOTAL', type:'UNDER', thr:4.5, games: allGames },
  { label: 'AV Casa >0.5', stat:'GOLS', target:'HOME', type:'OVER', thr:0.5, games: homeHist||[] },
  { label: 'AV Casa >1.5', stat:'GOLS', target:'HOME', type:'OVER', thr:1.5, games: homeHist||[] },
  { label: 'AV Casa <3.5', stat:'GOLS', target:'HOME', type:'UNDER', thr:3.5, games: homeHist||[] },
  { label: 'LIV Fora >0.5', stat:'GOLS', target:'AWAY', type:'OVER', thr:0.5, games: awayHist||[] },
  { label: 'LIV Fora >1.5', stat:'GOLS', target:'AWAY', type:'OVER', thr:1.5, games: awayHist||[] },
  { label: 'LIV Fora <3.5', stat:'GOLS', target:'AWAY', type:'UNDER', thr:3.5, games: awayHist||[] },
  { label: 'AV Escanteios >3.5 (Casa)', stat:'ESCANTEIOS', target:'HOME', type:'OVER', thr:3.5, games: homeHist||[] },
  { label: 'AV Escanteios >4.5 (Casa)', stat:'ESCANTEIOS', target:'HOME', type:'OVER', thr:4.5, games: homeHist||[] },
  { label: 'LIV Escanteios >3.5 (Fora)', stat:'ESCANTEIOS', target:'AWAY', type:'OVER', thr:3.5, games: awayHist||[] },
  { label: 'LIV Escanteios >4.5 (Fora)', stat:'ESCANTEIOS', target:'AWAY', type:'OVER', thr:4.5, games: awayHist||[] },
  { label: 'Total Escanteios >8.5', stat:'ESCANTEIOS', target:'TOTAL', type:'OVER', thr:8.5, games: allGames },
  { label: 'Total Escanteios >9.5', stat:'ESCANTEIOS', target:'TOTAL', type:'OVER', thr:9.5, games: allGames },
  { label: 'Total Escanteios >10.5', stat:'ESCANTEIOS', target:'TOTAL', type:'OVER', thr:10.5, games: allGames },
  { label: 'Total Cartões >1.5', stat:'CARTÕES', target:'TOTAL', type:'OVER', thr:1.5, games: allGames },
  { label: 'Total Cartões >2.5', stat:'CARTÕES', target:'TOTAL', type:'OVER', thr:2.5, games: allGames },
  { label: 'Total Cartões >3.5', stat:'CARTÕES', target:'TOTAL', type:'OVER', thr:3.5, games: allGames },
  { label: 'AV Cartões >0.5 (Casa)', stat:'CARTÕES', target:'HOME', type:'OVER', thr:0.5, games: homeHist||[] },
  { label: 'AV Cartões >1.5 (Casa)', stat:'CARTÕES', target:'HOME', type:'OVER', thr:1.5, games: homeHist||[] },
  { label: 'LIV Cartões >0.5 (Fora)', stat:'CARTÕES', target:'AWAY', type:'OVER', thr:0.5, games: awayHist||[] },
  { label: 'BTTS AV Casa', stat:'BTTS', target:'HOME', type:'OVER', thr:0, games: homeHist||[] },
  { label: 'BTTS LIV Fora', stat:'BTTS', target:'AWAY', type:'OVER', thr:0, games: awayHist||[] },
];

console.log('\n=== PROBABILIDADES ===');
const results = [];
for (const c of checks) {
  const res = evalStat(c.games, matchTotals, c.stat, c.target, c.type, c.thr);
  if (res) {
    results.push({ ...c, ...res });
    const bar = '█'.repeat(Math.round(res.pct/10));
    console.log(`  ${String(Math.round(res.pct)).padStart(3)}% (${res.hits}/${res.total}) ${bar.padEnd(10)} — ${c.label}`);
  }
}

// Odds Bet365
console.log('\nBuscando odds Bet365...');
const oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${FIXTURE_API_ID}&bookmaker=${BOOKMAKER_ID}`);
const bet365 = (oddsResp||[]).flatMap(r => r.bookmakers||[]).find(b => b.id === BOOKMAKER_ID);
if (!bet365) { console.log('Sem odds'); process.exit(0); }

const relevantBets = [1, 5, 6, 8, 16, 17, 26, 45, 57, 58, 77, 80, 82, 83, 87, 88, 89];
console.log('\n=== ODDS BET365 ===');
for (const bet of (bet365.bets||[])) {
  if (!relevantBets.includes(bet.id)) continue;
  const lines = (bet.values||[]).map(v => `${v.value}@${v.odd}`).join(' | ');
  console.log(`  [${bet.id}] ${bet.name}: ${lines}`);
}

// Resumo de melhores picks ≥ 1.7
console.log('\n=== RECOMENDAÇÃO (picks ≥70% prob com odds disponíveis ≥1.60) ===');
// Map our calculated stats to bet365 markets
const marketMap = {
  '5_OVER_2.5':  { betId: 5,  odd: null },
  '5_UNDER_4.5': { betId: 5,  odd: null },
  '45_OVER_9.5': { betId: 45, odd: null },
  '45_OVER_8.5': { betId: 45, odd: null }, // use 9.5 proxy
  '57_OVER_4.5': { betId: 57, odd: null },
  '58_OVER_4.5': { betId: 58, odd: null },
  '80_OVER_3.5': { betId: 80, odd: null },
  '80_OVER_4.0': { betId: 80, odd: null },
  '82_OVER_1.5': { betId: 82, odd: null },
  '8_Yes':       { betId: 8,  odd: null },
};
for (const bet of (bet365.bets||[])) {
  for (const v of (bet.values||[])) {
    const m = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
    if (!m) continue;
    const key = `${bet.id}_${m[1].toUpperCase()}_${m[2]}`;
    if (marketMap[key]) marketMap[key].odd = parseFloat(v.odd);
  }
  // BTTS
  if (bet.id === 8) {
    const yes = (bet.values||[]).find(v => v.value === 'Yes');
    if (yes) marketMap['8_Yes'].odd = parseFloat(yes.odd);
  }
}

const recs = [
  { label: 'Total Gols >2.5', key: '5_OVER_2.5',  probKey: 'Total Gols >2.5' },
  { label: 'Total Escanteios >9.5', key: '45_OVER_9.5', probKey: 'Total Escanteios >9.5' },
  { label: 'AV Escanteios >4.5', key: '57_OVER_4.5', probKey: 'AV Escanteios >4.5 (Casa)' },
  { label: 'LIV Escanteios >4.5', key: '58_OVER_4.5', probKey: 'LIV Escanteios >4.5 (Fora)' },
  { label: 'Total Cartões >3.5', key: '80_OVER_3.5', probKey: 'Total Cartões >3.5' },
  { label: 'Total Cartões >4.0', key: '80_OVER_4.0', probKey: 'Total Cartões >3.5' },
  { label: 'AV Cartões >1.5', key: '82_OVER_1.5', probKey: 'AV Cartões >1.5 (Casa)' },
  { label: 'BTTS (Ambas marcam)', key: '8_Yes', probKey: 'BTTS AV Casa' },
];
for (const rec of recs) {
  const m = marketMap[rec.key];
  const r = results.find(x => x.label === rec.probKey);
  if (m?.odd && r) {
    console.log(`  ${rec.label}: odd=${m.odd} prob=${Math.round(r.pct)}% (${r.hits}/${r.total})`);
  }
}
