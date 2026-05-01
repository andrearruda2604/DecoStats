/**
 * Regenera bilhetes passados com o novo algoritmo e depois avalia resultados.
 * 
 * Fluxo íntegro:
 *   1. Para cada data, busca fixtures (qualquer status) e odds da API
 *   2. Gera o bilhete com o novo algoritmo (sem saber o resultado)
 *   3. Salva o bilhete como PENDING
 *   4. DEPOIS avalia o resultado real (WON/LOST)
 *
 * Uso: node scratch/regenerateAll.js
 *   ou: node scratch/regenerateAll.js 2026-04-21
 */
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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;
const API_KEY = env.VITE_API_FOOTBALL_KEY || env.API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error('Missing Credentials'); process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const API_HEADERS = { 'x-apisports-key': API_KEY };

// ─── mesmas configs do generateOdd2.js (novo algoritmo) ──────────────────────

const TARGET_LOW  = 1.90;
const TARGET_HIGH = 2.10;
const MIN_PICKS   = 3;
const MAX_PICKS   = 12;
const MAX_PICKS_PER_MATCH_DEFAULT = 2;
const MAX_PICKS_PER_MATCH_FEW_GAMES = 3;
const MIN_IMPLIED_PROB = 60;
const MIN_ODD = 1.04;
const BOOKMAKER_ID = 8;

const MARKETS = {
  5:  { label: 'Gols FT (Total)',    stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL', statKey: 'total_goals'    },
  6:  { label: 'Gols 1T (Total)',    stat: 'GOLS',       period: 'HT', teamTarget: 'TOTAL', statKey: 'ht_total_goals' },
  26: { label: 'Gols 2T (Total)',    stat: 'GOLS',       period: '2H', teamTarget: 'TOTAL', statKey: '2h_total_goals' },
  16: { label: 'Gols FT (Casa)',     stat: 'GOLS',       period: 'FT', teamTarget: 'HOME',  statKey: 'home_score'     },
  17: { label: 'Gols FT (Fora)',     stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY',  statKey: 'away_score'     },
  105: { label: 'Gols 1T (Casa)',    stat: 'GOLS',       period: 'HT', teamTarget: 'HOME',  statKey: 'ht_home_score'  },
  106: { label: 'Gols 1T (Fora)',    stat: 'GOLS',       period: 'HT', teamTarget: 'AWAY',  statKey: 'ht_away_score'  },
  107: { label: 'Gols 2T (Casa)',    stat: 'GOLS',       period: '2H', teamTarget: 'HOME',  statKey: '2h_home_score'  },
  108: { label: 'Gols 2T (Fora)',    stat: 'GOLS',       period: '2H', teamTarget: 'AWAY',  statKey: '2h_away_score'  },
  45: { label: 'Escanteios FT',      stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'TOTAL', statKey: 'total_corners'  },
  57: { label: 'Escanteios FT (Casa)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'HOME',  statKey: 'home_corners'   },
  58: { label: 'Escanteios FT (Fora)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY',  statKey: 'away_corners'   },
  80: { label: 'Cartões FT (Total)', stat: 'CARTÃO AMARELO', period: 'FT', teamTarget: 'TOTAL', statKey: 'total_cards' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchApi(url) {
  for (let i = 3; i > 0; i--) {
    try {
      const r = await fetch(url, { headers: API_HEADERS });
      const d = await r.json();
      if (d.errors && Object.keys(d.errors).length > 0) throw new Error(JSON.stringify(d.errors));
      return d.response || [];
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── odds parsing (idêntico ao generateOdd2.js) ──────────────────────────────

function parseCandidatesFromOdds(fixtureApiId, homeName, awayName, oddsResponse) {
  const bet365 = (oddsResponse || [])
    .flatMap(r => r.bookmakers || [])
    .find(b => b.id === BOOKMAKER_ID);
  if (!bet365) return [];

  const candidates = [];
  for (const bet of (bet365.bets || [])) {
    const market = MARKETS[bet.id];
    if (!market) continue;

    const pairs = {};
    for (const v of (bet.values || [])) {
      const m = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!m) continue;
      const type = m[1].toLowerCase();
      const threshold = parseFloat(m[2]);
      if (!pairs[threshold]) pairs[threshold] = {};
      pairs[threshold][type] = parseFloat(v.odd);
    }

    for (const [threshStr, sides] of Object.entries(pairs)) {
      const threshold = parseFloat(threshStr);
      if (!sides.over || !sides.under) continue;

      const pOver  = (1 / sides.over);
      const pUnder = (1 / sides.under);
      const total  = pOver + pUnder;
      const normOver  = (pOver  / total) * 100;
      const normUnder = (pUnder / total) * 100;

      const teamName = market.teamTarget === 'HOME' ? homeName
                     : market.teamTarget === 'AWAY' ? awayName
                     : 'Total';

      for (const [sideKey, normProb, odd] of [
        ['over', normOver, sides.over],
        ['under', normUnder, sides.under],
      ]) {
        if (normProb < MIN_IMPLIED_PROB) continue;
        if (odd < MIN_ODD) continue;

        candidates.push({
          fixture_id: fixtureApiId,
          betId: bet.id,
          market: market.label,
          stat: market.stat,
          period: market.period,
          teamTarget: market.teamTarget,
          statKey: market.statKey,
          team: teamName,
          type: sideKey.toUpperCase(),
          threshold,
          line: `${sideKey === 'over' ? 'Mais de' : 'Menos de'} ${threshold}`,
          odd,
          probability: Math.round(normProb),
        });
      }
    }
  }
  return candidates;
}

// ─── accumulator (novo algoritmo) ─────────────────────────────────────────────

function buildAccumulator(allCandidates, maxPicksPerMatch) {
  const deduped = [];
  const seen = new Set();
  for (const c of allCandidates) {
    const key = `${c.fixture_id}-${c.betId}-${c.threshold}-${c.type}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
  }

  const selected = [];
  const picksPerMatch = {};
  const usedKeys = new Set();
  let currentOdd = 1.0;

  function canAdd(candidate) {
    const key = `${candidate.fixture_id}-${candidate.betId}-${candidate.threshold}-${candidate.type}`;
    if (usedKeys.has(key)) return false;
    const matchCount = picksPerMatch[candidate.fixture_id] || 0;
    if (matchCount >= maxPicksPerMatch) return false;
    return true;
  }

  function doAdd(candidate) {
    const key = `${candidate.fixture_id}-${candidate.betId}-${candidate.threshold}-${candidate.type}`;
    selected.push(candidate);
    usedKeys.add(key);
    picksPerMatch[candidate.fixture_id] = (picksPerMatch[candidate.fixture_id] || 0) + 1;
    currentOdd *= candidate.odd;
  }

  while (selected.length < MAX_PICKS) {
    if (currentOdd >= TARGET_LOW && selected.length >= MIN_PICKS) break;

    const ratio = TARGET_LOW / currentOdd;
    const available = deduped.filter(c => canAdd(c) && currentOdd * c.odd <= TARGET_HIGH);
    if (available.length === 0) break;

    let pick;
    if (ratio > 1.3) {
      available.sort((a, b) => b.odd - a.odd || b.probability - a.probability);
      pick = available[0];
    } else {
      available.sort((a, b) => b.probability - a.probability || b.odd - a.odd);
      pick = available[0];
    }
    doAdd(pick);
  }

  if (currentOdd < TARGET_LOW && selected.length < MAX_PICKS) {
    const maxAllowed = TARGET_HIGH + 0.15;
    const fallbacks = deduped
      .filter(c => canAdd(c))
      .filter(c => { const proj = currentOdd * c.odd; return proj >= TARGET_LOW && proj <= maxAllowed; })
      .sort((a, b) => b.probability - a.probability);
    if (fallbacks.length > 0) doAdd(fallbacks[0]);
  }

  return { selected, total: currentOdd };
}

// ─── avaliação (idêntico ao evaluateOdd2.js) ──────────────────────────────────

const STAT_MAPPING = {
  'CHUTES': 'Total Shots',
  'CHUTES NO GOL': 'Shots on Goal',
  'ESCANTEIOS': 'Corner Kicks',
  'FALTAS COMETIDAS': 'Fouls',
  'CARTÃO AMARELO': 'Yellow Cards',
  'GOLS MARCADOS': 'Goals'
};

async function evaluateTicket(ticket) {
  const entries = ticket.ticket_data.entries || [];
  let allGreen = true;

  for (const entry of entries) {
    const statsData = await fetchApi(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${entry.fixture_id}`);
    const teamsStats = statsData || [];
    const fixData = await fetchApi(`https://v3.football.api-sports.io/fixtures?id=${entry.fixture_id}`);
    const matchDetail = fixData?.[0];

    if (!matchDetail || !['FT', 'AET', 'PEN'].includes(matchDetail.fixture.status.short)) {
      console.log(`  ⚠️ ${entry.home} x ${entry.away} — partida não finalizada`);
      allGreen = false;
      continue;
    }

    const homeGoals = matchDetail.goals.home || 0;
    const awayGoals = matchDetail.goals.away || 0;
    let matchGreen = true;

    for (const pick of entry.picks) {
      const line = pick.threshold !== undefined ? pick.threshold : parseFloat(pick.line.split(' ').pop());
      const isHome = pick.teamTarget === 'HOME';
      let actualValue = 0;

      if (pick.stat === 'GOLS' || pick.stat === 'GOLS MARCADOS') {
        const htHome = matchDetail.score?.halftime?.home || 0;
        const htAway = matchDetail.score?.halftime?.away || 0;
        if (pick.period === 'FT') {
          actualValue = pick.teamTarget === 'TOTAL' ? (homeGoals + awayGoals) : (isHome ? homeGoals : awayGoals);
        } else if (pick.period === 'HT') {
          actualValue = pick.teamTarget === 'TOTAL' ? (htHome + htAway) : (isHome ? htHome : htAway);
        } else if (pick.period === '2H') {
          const ftG = pick.teamTarget === 'TOTAL' ? (homeGoals + awayGoals) : (isHome ? homeGoals : awayGoals);
          const htG = pick.teamTarget === 'TOTAL' ? (htHome + htAway) : (isHome ? htHome : htAway);
          actualValue = ftG - htG;
        }
      } else {
        const translatedType = STAT_MAPPING[pick.stat] || pick.stat;
        const homeStatsArr = teamsStats.find(s => s.team.id === matchDetail.teams.home.id)?.statistics || [];
        const awayStatsArr = teamsStats.find(s => s.team.id === matchDetail.teams.away.id)?.statistics || [];

        let val = 0;
        if (pick.teamTarget === 'TOTAL') {
          const hStat = homeStatsArr.find(s => s.type === translatedType);
          const aStat = awayStatsArr.find(s => s.type === translatedType);
          val += hStat && hStat.value !== null ? parseInt(hStat.value) : 0;
          val += aStat && aStat.value !== null ? parseInt(aStat.value) : 0;
        } else {
          const teamStatsArr = isHome ? homeStatsArr : awayStatsArr;
          const statObj = teamStatsArr.find(s => s.type === translatedType);
          val = statObj && statObj.value !== null ? parseInt(statObj.value) : 0;
        }

        if (pick.period === 'HT') {
          actualValue = Math.floor(val / 2);
        } else if (pick.period === '2H') {
          actualValue = Math.ceil(val / 2);
        } else {
          actualValue = val;
        }
      }

      const isPickGreen = pick.type === 'UNDER' ? actualValue < line : actualValue > line;
      if (!isPickGreen) { matchGreen = false; allGreen = false; }
      pick.result = isPickGreen ? 'WON' : 'LOST';
      pick.actualValue = actualValue;
      console.log(`    [${pick.result}] ${pick.period} ${pick.stat} ${pick.teamTarget} ${pick.type === 'UNDER' ? '<' : '>'} ${line} (Fez: ${actualValue})`);
    }

    entry.matchResult = matchGreen ? 'WON' : 'LOST';
    await delay(1000);
  }

  return allGreen ? 'WON' : 'LOST';
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function regenerateForDate(targetDate) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📅 REGENERANDO BILHETE: ${targetDate}`);
  console.log('═'.repeat(60));

  // 1. Ligas ativas
  const { data: leagues } = await supabase
    .from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  // 2. Fixtures do dia (QUALQUER status — inclui FT para jogos passados)
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('api_id, date, status, season, home_team:teams!fixtures_home_team_id_fkey(name, logo_url), away_team:teams!fixtures_away_team_id_fkey(name, logo_url), league:leagues!fixtures_league_id_fkey(api_id)')
    .gte('date', `${targetDate} 00:00:00`)
    .lte('date', `${targetDate} 23:59:59`);

  const candidates = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`\nFixtures do dia: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nenhum fixture encontrado. Pulando.');
    return null;
  }

  // 3. Para cada fixture, busca odds reais (a API mantém odds históricas)
  const allPickCandidates = [];
  for (const f of candidates) {
    const homeName = f.home_team?.name || 'Casa';
    const awayName = f.away_team?.name || 'Fora';
    process.stdout.write(`  ${homeName} x ${awayName} ... `);

    try {
      const oddsResp = await fetchApi(
        `https://v3.football.api-sports.io/odds?fixture=${f.api_id}&bookmaker=${BOOKMAKER_ID}`
      );
      const picks = parseCandidatesFromOdds(f.api_id, homeName, awayName, oddsResp);
      console.log(`${picks.length} candidato(s)`);
      allPickCandidates.push(...picks.map(p => ({
        ...p,
        home: homeName,
        away: awayName,
        homeLogo: f.home_team?.logo_url || '',
        awayLogo: f.away_team?.logo_url || '',
        date_time: f.date,
      })));
      await delay(800);
    } catch (e) {
      console.log(`erro: ${e.message}`);
    }
  }

  console.log(`Total de candidatos: ${allPickCandidates.length}`);

  if (allPickCandidates.length < MIN_PICKS) {
    console.log('Odds insuficientes. Pulando.');
    return null;
  }

  // 4. Monta acumuladora com NOVO algoritmo
  const uniqueFixtures = new Set(allPickCandidates.map(c => c.fixture_id));
  const maxPerMatch = uniqueFixtures.size <= 4 ? MAX_PICKS_PER_MATCH_FEW_GAMES : MAX_PICKS_PER_MATCH_DEFAULT;
  const { selected, total } = buildAccumulator(allPickCandidates, maxPerMatch);

  console.log(`\nPicks selecionados: ${selected.length} | Odd total: ${total.toFixed(2)}`);

  // 5. Monta entries
  const entriesMap = {};
  for (const pick of selected) {
    if (!entriesMap[pick.fixture_id]) {
      entriesMap[pick.fixture_id] = {
        fixture_id: pick.fixture_id,
        home: pick.home, away: pick.away,
        homeLogo: pick.homeLogo, awayLogo: pick.awayLogo,
        date_time: pick.date_time,
        picks: [],
      };
    }
    entriesMap[pick.fixture_id].picks.push({
      betId: pick.betId, statKey: pick.statKey, stat: pick.stat,
      period: pick.period, teamTarget: pick.teamTarget, team: pick.team,
      type: pick.type, threshold: pick.threshold, line: pick.line,
      odd: pick.odd, probability: pick.probability, market: pick.market,
    });
  }

  const entries = Object.values(entriesMap);
  const allPicks = entries.flatMap(e => e.picks);
  const avgConfidence = Math.round(allPicks.reduce((a, b) => a + b.probability, 0) / allPicks.length);
  const totalOdd = allPicks.reduce((a, b) => a * b.odd, 1.0);

  // Log do bilhete
  console.log('\n── BILHETE GERADO ──');
  for (const e of entries) {
    console.log(`\n  ${e.home} x ${e.away}`);
    for (const p of e.picks) {
      console.log(`    [${p.probability}%] ${p.team}: ${p.line} ${p.stat} (${p.period}) → odd ${p.odd}`);
    }
  }
  console.log(`\n  Odd Total: ${totalOdd.toFixed(2)} | Confiança: ${avgConfidence}%`);

  // 6. Salva como PENDING (antes de avaliar)
  const ticketData = {
    date: targetDate,
    matches_count: entries.length,
    total_odd: totalOdd.toFixed(2),
    status: 'PENDING',
    ticket_data: {
      entries,
      confidence_score: avgConfidence,
      generated_at: new Date().toISOString(),
    }
  };

  await supabase.from('odd_tickets').upsert(ticketData, { onConflict: 'date' });
  console.log('✓ Bilhete salvo como PENDING');

  // 7. AGORA avalia o resultado
  console.log('\n── AVALIANDO RESULTADO ──');
  const finalStatus = await evaluateTicket(ticketData);

  // 8. Salva resultado final
  await supabase.from('odd_tickets').update({
    status: finalStatus,
    ticket_data: ticketData.ticket_data
  }).eq('date', targetDate);

  const emoji = finalStatus === 'WON' ? '🟢' : '🔴';
  console.log(`\n${emoji} Resultado: ${finalStatus} | Odd: ${totalOdd.toFixed(2)}`);

  return { date: targetDate, status: finalStatus, odd: totalOdd.toFixed(2) };
}

async function main() {
  const singleDate = process.argv[2];

  let dates;
  if (singleDate) {
    dates = [singleDate];
  } else {
    // Busca todas as datas com bilhetes no banco
    const today = new Date().toISOString().split('T')[0];
    const { data: tickets } = await supabase
      .from('odd_tickets')
      .select('date')
      .lt('date', today)
      .order('date', { ascending: true });

    dates = (tickets || []).map(t => t.date);
  }

  console.log(`\n🔄 Regenerando ${dates.length} bilhete(s)...\n`);

  const results = [];
  for (const date of dates) {
    const result = await regenerateForDate(date);
    if (result) results.push(result);
    await delay(2000); // Rate limit entre datas
  }

  // Resumo final
  console.log('\n\n' + '═'.repeat(60));
  console.log('RESUMO FINAL (NOVO ALGORITMO)');
  console.log('═'.repeat(60));

  let won = 0, lost = 0;
  for (const r of results) {
    const emoji = r.status === 'WON' ? '🟢' : '🔴';
    console.log(`${emoji} ${r.date} | Odd: ${r.odd} | ${r.status}`);
    if (r.status === 'WON') won++;
    if (r.status === 'LOST') lost++;
  }
  const total = won + lost;
  console.log(`\n✅ Green: ${won} | ❌ Red: ${lost} | Taxa: ${total > 0 ? Math.round(won / total * 100) : 0}%`);
}

main().catch(console.error);
