/**
 * Bilhete Odd 2.0 — odds reais da Bet365 via API-Football
 * Alvo: múltipla ~2.00 usando picks de alta probabilidade (>65%)
 *
 * Mercados usados:
 *   Bet  5 → Goals Over/Under (total da partida)
 *   Bet  6 → Goals Over/Under (1º tempo)
 *   Bet 16 → Total - Home (gols mandante)
 *   Bet 17 → Total - Away (gols visitante)
 *   Bet 45 → Corners Over/Under (total)
 *   Bet 57 → Home Corners Over/Under
 *   Bet 58 → Away Corners Over/Under
 *   Bet 80 → Cards Over/Under (total)
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

// ─── config ──────────────────────────────────────────────────────────────────

const TARGET_LOW  = 1.90;
const TARGET_HIGH = 2.15;
const MIN_PICKS   = 3;
const MAX_PICKS   = 10;
const MAX_PICKS_PER_MATCH = 2;
const MIN_IMPLIED_PROB = 55; // % (odds ≤ ~1.80)
const MIN_ODD = 1.08;        // não aceitar odds irrisórias (< 1.08)
const BOOKMAKER_ID = 8;      // Bet365

// bet_id → metadados do mercado
const MARKETS = {
  // Gols — Total da partida
  5:  { label: 'Gols FT (Total)',    stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL', statKey: 'total_goals'    },
  6:  { label: 'Gols 1T (Total)',    stat: 'GOLS',       period: 'HT', teamTarget: 'TOTAL', statKey: 'ht_total_goals' },
  26: { label: 'Gols 2T (Total)',    stat: 'GOLS',       period: '2H', teamTarget: 'TOTAL', statKey: '2h_total_goals' },
  // Gols — Por equipe (FT)
  16: { label: 'Gols FT (Casa)',     stat: 'GOLS',       period: 'FT', teamTarget: 'HOME',  statKey: 'home_score'     },
  17: { label: 'Gols FT (Fora)',     stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY',  statKey: 'away_score'     },
  // Gols — Por equipe (1T)
  105: { label: 'Gols 1T (Casa)',    stat: 'GOLS',       period: 'HT', teamTarget: 'HOME',  statKey: 'ht_home_score'  },
  106: { label: 'Gols 1T (Fora)',    stat: 'GOLS',       period: 'HT', teamTarget: 'AWAY',  statKey: 'ht_away_score'  },
  // Gols — Por equipe (2T)
  107: { label: 'Gols 2T (Casa)',    stat: 'GOLS',       period: '2H', teamTarget: 'HOME',  statKey: '2h_home_score'  },
  108: { label: 'Gols 2T (Fora)',    stat: 'GOLS',       period: '2H', teamTarget: 'AWAY',  statKey: '2h_away_score'  },
  // Escanteios
  45: { label: 'Escanteios FT',      stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'TOTAL', statKey: 'total_corners'  },
  57: { label: 'Escanteios FT (Casa)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'HOME',  statKey: 'home_corners'   },
  58: { label: 'Escanteios FT (Fora)',stat:'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY',  statKey: 'away_corners'   },
  // Cartões
  80: { label: 'Cartões FT (Total)', stat: 'CARTÃO AMARELO', period: 'FT', teamTarget: 'TOTAL', statKey: 'total_cards' },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

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

// ─── odds parsing ─────────────────────────────────────────────────────────────

/**
 * Retorna candidatos de picks de um fixture com odds reais.
 * Normaliza a probabilidade implícita para remover a margem do bookmaker.
 */
function parseCandidatesFromOdds(fixtureApiId, homeName, awayName, oddsResponse) {
  const bet365 = (oddsResponse || [])
    .flatMap(r => r.bookmakers || [])
    .find(b => b.id === BOOKMAKER_ID);
  if (!bet365) return [];

  const candidates = [];

  for (const bet of (bet365.bets || [])) {
    const market = MARKETS[bet.id];
    if (!market) continue;

    // Agrupa valores por linha (threshold): "Over 2.5" e "Under 2.5" formam um par
    const pairs = {};
    for (const v of (bet.values || [])) {
      const m = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!m) continue;
      const type = m[1].toLowerCase(); // 'over' | 'under'
      const threshold = parseFloat(m[2]);
      if (!pairs[threshold]) pairs[threshold] = {};
      pairs[threshold][type] = parseFloat(v.odd);
    }

    for (const [threshStr, sides] of Object.entries(pairs)) {
      const threshold = parseFloat(threshStr);
      if (!sides.over || !sides.under) continue; // precisa dos dois lados

      // Normaliza para remover margem do bookmaker
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

// ─── accumulator builder ──────────────────────────────────────────────────────

/**
 * Seleciona picks para acumular próximo de TARGET usando greedy + backtracking leve.
 * Ordena por probabilidade decrescente; max MAX_PICKS_PER_MATCH por jogo.
 */
function buildAccumulator(allCandidates) {
  // Remove duplicatas (mesmo fixture + mercado + linha + tipo)
  const deduped = [];
  const seen = new Set();
  for (const c of allCandidates) {
    const key = `${c.fixture_id}-${c.betId}-${c.threshold}-${c.type}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(c); }
  }

  // Pontuação: prioriza picks com maior (probabilidade × odd).
  // Isso favorece o sweet spot 1.15–1.35 (alta prob + impacto real na odd)
  // em vez de extremos (1.04 muito seguro, 1.70 pouco provável).
  deduped.sort((a, b) => (b.probability * b.odd) - (a.probability * a.odd));

  const selected = [];
  const picksPerMatch = {};
  let currentOdd = 1.0;

  for (const c of deduped) {
    if (selected.length >= MAX_PICKS) break;
    if (currentOdd >= TARGET_LOW && selected.length >= MIN_PICKS) break;

    const matchCount = picksPerMatch[c.fixture_id] || 0;
    if (matchCount >= MAX_PICKS_PER_MATCH) continue;

    const projected = currentOdd * c.odd;
    if (projected > TARGET_HIGH) continue; // só adiciona se não ultrapassar alvo

    selected.push(c);
    picksPerMatch[c.fixture_id] = matchCount + 1;
    currentOdd = projected;
  }

  // Segunda passagem: se ainda abaixo do alvo, aceita picks que ultrapassem ligeiramente
  if (currentOdd < TARGET_LOW && selected.length < MAX_PICKS) {
    for (const c of deduped) {
      if (selected.includes(c)) continue;
      if (selected.length >= MAX_PICKS) break;
      const matchCount = picksPerMatch[c.fixture_id] || 0;
      if (matchCount >= MAX_PICKS_PER_MATCH) continue;
      const projected = currentOdd * c.odd;
      if (projected > TARGET_HIGH + 0.40) continue;
      selected.push(c);
      picksPerMatch[c.fixture_id] = (picksPerMatch[c.fixture_id] || 0) + 1;
      currentOdd = projected;
      if (currentOdd >= TARGET_LOW) break;
    }
  }

  return { selected, total: currentOdd };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function generateOdd2() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = process.argv[2] || brt.toISOString().split('T')[0];
  console.log(`\n=== Gerando Bilhete Odd 2.0 para ${today} ===\n`);

  // 1. Ligas ativas
  const { data: leagues } = await supabase
    .from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  // 2. Fixtures do dia (apenas NS = não iniciados)
  const { data: fixtures } = await supabase
    .from('fixtures')
    .select('api_id, date, status, season, home_team:teams!fixtures_home_team_id_fkey(name, logo_url), away_team:teams!fixtures_away_team_id_fkey(name, logo_url), league:leagues!fixtures_league_id_fkey(api_id)')
    .gte('date', `${today} 00:00:00`)
    .lte('date', `${today} 23:59:59`)
    .in('status', ['NS', 'TBD']);

  const candidates = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`Fixtures disponíveis: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nenhum fixture não-iniciado encontrado para hoje. Abortando.');
    return;
  }

  // 3. Para cada fixture, busca odds reais
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

  console.log(`\nTotal de candidatos: ${allPickCandidates.length}`);

  if (allPickCandidates.length < MIN_PICKS) {
    console.log('Odds insuficientes disponíveis. Salvando bilhete vazio.');
    await supabase.from('odd_tickets').upsert({
      date: today, matches_count: 0, total_odd: '1.00',
      status: 'PENDING',
      ticket_data: { entries: [], confidence_score: 0, generated_at: new Date().toISOString() }
    }, { onConflict: 'date' });
    return;
  }

  // 4. Monta acumuladora
  const { selected, total } = buildAccumulator(allPickCandidates);
  console.log(`\nPicks selecionados: ${selected.length} | Odd total: ${total.toFixed(2)}`);

  // 5. Converte para formato ticket_data.entries (agrupa por fixture)
  const entriesMap = {};
  for (const pick of selected) {
    if (!entriesMap[pick.fixture_id]) {
      entriesMap[pick.fixture_id] = {
        fixture_id: pick.fixture_id,
        home: pick.home,
        away: pick.away,
        homeLogo: pick.homeLogo,
        awayLogo: pick.awayLogo,
        date_time: pick.date_time,
        picks: [],
      };
    }
    entriesMap[pick.fixture_id].picks.push({
      betId: pick.betId,
      statKey: pick.statKey,
      stat: pick.stat,
      period: pick.period,
      teamTarget: pick.teamTarget,
      team: pick.team,
      type: pick.type,
      threshold: pick.threshold,
      line: pick.line,
      odd: pick.odd,
      probability: pick.probability,
      market: pick.market,
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
      console.log(`    [${p.probability}%] ${p.team}: ${p.line} ${p.stat} (${p.period}) → odd ${p.odd} [${p.market}]`);
    }
  }
  console.log(`\n  Odd Total: ${totalOdd.toFixed(2)}`);
  console.log(`  Confiança Média: ${avgConfidence}%`);

  // 6. Salva no banco
  await supabase.from('odd_tickets').upsert({
    date: today,
    matches_count: entries.length,
    total_odd: totalOdd.toFixed(2),
    status: 'PENDING',
    ticket_data: {
      entries,
      confidence_score: avgConfidence,
      generated_at: new Date().toISOString(),
    }
  }, { onConflict: 'date' });

  console.log('\n✓ Bilhete salvo no banco.\n');
}

generateOdd2().catch(console.error);
