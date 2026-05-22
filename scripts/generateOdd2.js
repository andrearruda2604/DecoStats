/**
 * Bilhete Odd 2.0 — odds reais da Bet365 via API-Football
 * Alvo: múltipla ~2.00 usando picks de ALTA PROBABILIDADE HISTÓRICA
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

const TARGET_LOW  = 1.50;
const TARGET_HIGH = 2.30;
const MIN_PICKS   = 3;
const MAX_PICKS   = 8; 
const MAX_PICKS_PER_MATCH_DEFAULT = 2;
const MAX_PICKS_PER_MATCH_FEW_GAMES = 2; 

const MIN_HISTORICAL_PROB = 80; // Aceita apenas picks com confiança ≥ 80%
const MIN_ODD = 1.03;        // Pequeno aumento na odd mínima para evitar lixo de 1.01
const MIN_GAMES_HISTORY = 7;  // Mínimo de 7 jogos para incluir ligas com menos rodadas (ex: Argentina)
const BOOKMAKER_ID = 8;      

const MARKETS = {
  5:  { label: 'Gols JOGO (Total)',        stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  6:  { label: 'Gols 1° Tempo (Total)',   stat: 'GOLS',       period: 'HT', teamTarget: 'TOTAL' },
  26: { label: 'Gols 2° Tempo (Total)',   stat: 'GOLS',       period: '2H', teamTarget: 'TOTAL' },
  16: { label: 'Gols JOGO (Casa)',        stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols JOGO (Fora)',        stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
  105:{ label: 'Gols 1° Tempo (Casa)',    stat: 'GOLS',       period: 'HT', teamTarget: 'HOME'  },
  106:{ label: 'Gols 1° Tempo (Fora)',    stat: 'GOLS',       period: 'HT', teamTarget: 'AWAY'  },
  107:{ label: 'Gols 2° Tempo (Casa)',    stat: 'GOLS',       period: '2H', teamTarget: 'HOME'  },
  108:{ label: 'Gols 2° Tempo (Fora)',    stat: 'GOLS',       period: '2H', teamTarget: 'AWAY'  },
  45: { label: 'Escanteios JOGO (Total)', stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'TOTAL' },
  77: { label: 'Escanteios 1° Tempo (T)', stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'TOTAL' },
  57: { label: 'Escanteios JOGO (Casa)',  stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'HOME'  },
  58: { label: 'Escanteios JOGO (Fora)',  stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY'  },
  80: { label: 'Cartões JOGO (Total)',    stat: 'CARTÕES',    period: 'FT', teamTarget: 'TOTAL' },
  82: { label: 'Cartões JOGO (Casa)',     stat: 'CARTÕES',    period: 'FT', teamTarget: 'HOME'  },
  83: { label: 'Cartões JOGO (Fora)',     stat: 'CARTÕES',    period: 'FT', teamTarget: 'AWAY'  },
  87: { label: 'Chutes ao Gol (Total)',  stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'TOTAL' },
  88: { label: 'Chutes ao Gol (Casa)',   stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'HOME'  },
  89: { label: 'Chutes ao Gol (Fora)',   stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'AWAY'  },
  211:{ label: 'Chutes Totais',         stat: 'CHUTES_TOTAL', period: 'FT', teamTarget: 'TOTAL' },
  220:{ label: 'Chutes Totais (Fora)',  stat: 'CHUTES_TOTAL', period: 'FT', teamTarget: 'AWAY'  },
  221:{ label: 'Chutes Totais (Casa)',  stat: 'CHUTES_TOTAL', period: 'FT', teamTarget: 'HOME'  },
  132:{ label: 'Escanteios 1° Tempo (C)', stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'HOME'  },
  134:{ label: 'Escanteios 1° Tempo (F)', stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'AWAY'  },
  164:{ label: 'Impedimentos (Total)',  stat: 'IMPEDIMENTOS', period: 'FT', teamTarget: 'TOTAL' },
  167:{ label: 'Impedimentos (Casa)',   stat: 'IMPEDIMENTOS', period: 'FT', teamTarget: 'HOME'  },
  168:{ label: 'Impedimentos (Fora)',   stat: 'IMPEDIMENTOS', period: 'FT', teamTarget: 'AWAY'  },
  169:{ label: 'Cartões 1° Tempo (T)',  stat: 'CARTÕES',     period: 'HT', teamTarget: 'TOTAL' },
  170:{ label: 'Cartões 1° Tempo (C)',  stat: 'CARTÕES',     period: 'HT', teamTarget: 'HOME'  },
  171:{ label: 'Cartões 1° Tempo (F)',  stat: 'CARTÕES',     period: 'HT', teamTarget: 'AWAY'  },
};

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

/**
 * Avalia a frequência histórica com base na equipe alvo. 
 * Comportamento clássico restaurado: usa apenas o histórico da equipe em questão para manter as altas %.
 */
function evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals, htScores = {}) {
  if (!homeHistory) return null;
  
  let homeHits = 0;
  let awayHits = 0;
  let homeValid = 0;
  let awayValid = 0;

  for (const match of homeHistory) {
    let actualValue = 0;
    let isValid = false;
    
    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') {
        isValid = true;
        if (candidate.teamTarget === 'TOTAL') actualValue = (match.goals_for || 0) + (match.goals_against || 0);
        else if (candidate.teamTarget === 'HOME') actualValue = match.is_home ? (match.goals_for || 0) : (match.goals_against || 0); 
        else if (candidate.teamTarget === 'AWAY') actualValue = match.is_home ? (match.goals_against || 0) : (match.goals_for || 0); 
      } else if (candidate.period === 'HT' || candidate.period === '2H') {
        // Use fixtures table HT scores (reliable) instead of stats_1h.goals (incomplete)
        const ht = htScores[match.fixture_id];
        if (ht) {
          isValid = true;
          const htHome = ht.ht_home ?? 0, htAway = ht.ht_away ?? 0;
          const ftHome = match.goals_for || 0, ftAway = match.goals_against || 0;
          // Adjust for perspective: match.goals_for is always from this team's POV
          const teamHT = match.is_home ? htHome : htAway;
          const oppHT  = match.is_home ? htAway : htHome;
          if (candidate.period === 'HT') {
            if (candidate.teamTarget === 'TOTAL') actualValue = htHome + htAway;
            else if (candidate.teamTarget === 'HOME') actualValue = teamHT;
            else actualValue = oppHT;
          } else { // 2H
            const team2H = ftHome - teamHT;
            const opp2H  = ftAway - oppHT;
            if (candidate.teamTarget === 'TOTAL') actualValue = team2H + opp2H;
            else if (candidate.teamTarget === 'HOME') actualValue = team2H;
            else actualValue = opp2H;
          }
        }
      }
    } else if (candidate.stat === 'ESCANTEIOS') {
      if (candidate.period === 'HT') {
        if (candidate.teamTarget === 'TOTAL') {
           const tot = matchTotals[match.fixture_id];
           if (tot && tot.corners_ht != null) { actualValue = tot.corners_ht; isValid = true; }
        } else {
           const ck = match.stats_1h?.find(s => s.type === 'Corner Kicks');
           if (ck) { actualValue = parseInt(ck.value) || 0; isValid = true; }
        }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.corners != null) { actualValue = tot.corners; isValid = true; }
        } else {
          if (match.corners != null) { actualValue = match.corners; isValid = true; }
        }
      }
    } else if (candidate.stat === 'CARTÕES') {
      if (candidate.period === 'HT') {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.cards_ht != null) { actualValue = tot.cards_ht; isValid = true; }
        } else {
          const yc1h = match.stats_1h?.find(s => s.type === 'Yellow Cards');
          const rc1h = match.stats_1h?.find(s => s.type === 'Red Cards');
          if (yc1h || rc1h) { actualValue = (parseInt(yc1h?.value) || 0) + (parseInt(rc1h?.value) || 0); isValid = true; }
        }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.cards != null) { actualValue = tot.cards; isValid = true; }
        } else {
          const yellow = match.stats_ft?.find(s => s.type === 'Yellow Cards');
          const red    = match.stats_ft?.find(s => s.type === 'Red Cards');
          if (yellow || red) { actualValue = (parseInt(yellow?.value) || 0) + (parseInt(red?.value) || 0); isValid = true; }
        }
      }
    } else if (candidate.stat === 'CHUTES_GOL') {
      if (candidate.period === 'HT') {
        const s = match.stats_1h?.find(s => s.type === 'Shots on Goal');
        if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
      } else if (candidate.period === '2H') {
        const s = match.stats_2h?.find(s => s.type === 'Shots on Goal');
        if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.shots_on_goal_count >= 2) { actualValue = tot.shots_on_goal; isValid = true; }
        } else {
          if (match.shots_on_goal != null) { actualValue = match.shots_on_goal; isValid = true; }
        }
      }
    } else if (candidate.stat === 'CHUTES_TOTAL') {
      if (candidate.period === 'HT') {
        const s = match.stats_1h?.find(s => s.type === 'Total Shots');
        if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
      } else if (candidate.period === '2H') {
        const s = match.stats_2h?.find(s => s.type === 'Total Shots');
        if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.shots_total != null) { actualValue = tot.shots_total; isValid = true; }
        } else {
          if (match.shots_total != null) { 
            actualValue = match.shots_total; isValid = true; 
          } else {
            const s = match.stats_ft?.find(s => s.type === 'Total Shots');
            if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
          }
        }
      }
    } else if (candidate.stat === 'IMPEDIMENTOS') {
      if (candidate.period === 'HT') {
        const s = match.stats_1h?.find(s => s.type === 'Offsides');
        if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.offsides != null) { actualValue = tot.offsides; isValid = true; }
        } else {
          if (match.offsides != null) { 
            actualValue = match.offsides; isValid = true; 
          } else {
            const s = match.stats_ft?.find(s => s.type === 'Offsides');
            if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
          }
        }
      }
    } else if (candidate.stat === 'GOLS_SOFRIDOS') {
      // Gols concedidos — usa goals_against do time que defende
      if (candidate.period === 'FT') {
        isValid = true;
        actualValue = match.goals_against;
      } else if (candidate.period === 'HT' || candidate.period === '2H') {
        const ht = htScores[match.fixture_id];
        if (ht) {
          isValid = true;
          const htHome = ht.ht_home ?? 0, htAway = ht.ht_away ?? 0;
          const oppHT  = match.is_home ? htAway : htHome;
          if (candidate.period === 'HT') actualValue = oppHT;
          else actualValue = (match.goals_against || 0) - oppHT;
        }
      }
    } else if (candidate.stat === 'AMBOS_MARCAM') {
      if (candidate.period === 'FT') {
        if (match.goals_for != null && match.goals_against != null) {
          isValid = true;
          actualValue = (match.goals_for > 0 && match.goals_against > 0) ? 1 : 0;
        }
      } else if (candidate.period === 'HT') {
        const ht = htScores[match.fixture_id];
        if (ht) { isValid = true; actualValue = (ht.ht_home > 0 && ht.ht_away > 0) ? 1 : 0; }
      } else if (candidate.period === '2H') {
        const ht = htScores[match.fixture_id];
        if (ht && match.goals_for != null) {
          isValid = true;
          const teamHT = match.is_home ? (ht.ht_home ?? 0) : (ht.ht_away ?? 0);
          const oppHT  = match.is_home ? (ht.ht_away ?? 0) : (ht.ht_home ?? 0);
          actualValue = ((match.goals_for - teamHT) > 0 && (match.goals_against - oppHT) > 0) ? 1 : 0;
        }
      }
    } else if (candidate.stat === 'CLEAN_SHEET') {
      if (match.goals_against != null) { isValid = true; actualValue = match.goals_against === 0 ? 1 : 0; }
    } else if (candidate.stat === 'DUPLA_CHANCE') {
      if (match.goals_for != null && match.goals_against != null) {
        isValid = true;
        const hG = match.is_home ? match.goals_for : match.goals_against;
        const aG = match.is_home ? match.goals_against : match.goals_for;
        if (candidate.type === 'HD') actualValue = hG >= aG ? 1 : 0;
        else if (candidate.type === 'HA') actualValue = hG !== aG ? 1 : 0;
        else actualValue = aG >= hG ? 1 : 0;
      }
    } else if (candidate.stat === 'RESULTADO_HT') {
      const ht = htScores[match.fixture_id];
      if (ht) { isValid = true; const o = ht.ht_home > ht.ht_away ? 'H' : ht.ht_home < ht.ht_away ? 'A' : 'D'; actualValue = o === candidate.type ? 1 : 0; }
    } else if (candidate.stat === 'RESULTADO_2H') {
      const ht = htScores[match.fixture_id];
      if (ht && match.goals_for != null) {
        isValid = true;
        const ftH = match.is_home ? match.goals_for : match.goals_against;
        const ftA = match.is_home ? match.goals_against : match.goals_for;
        const h2H = (ftH || 0) - (ht.ht_home ?? 0), a2H = (ftA || 0) - (ht.ht_away ?? 0);
        const o = h2H > a2H ? 'H' : h2H < a2H ? 'A' : 'D';
        actualValue = o === candidate.type ? 1 : 0;
      }
    }

    if (isValid) {
      homeValid++;
      if (candidate.type === 'OVER' && actualValue > candidate.threshold) homeHits++;
      else if (candidate.type === 'UNDER' && actualValue < candidate.threshold) homeHits++;
      else if (['YES','H','D','A','HD','HA','DA'].includes(candidate.type) && actualValue === 1) homeHits++;
      else if (candidate.type === 'NO' && actualValue === 0) homeHits++;
    }
  }

  if (candidate.teamTarget !== 'TOTAL') {
    if (homeValid < MIN_GAMES_HISTORY) return null;
    return { pct: (homeHits / homeValid) * 100, hits: homeHits, total: homeValid };
  }

  for (const match of (awayHistory || [])) {
    let actualValue = 0;
    let isValid = false;

    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') {
        isValid = true;
        actualValue = (match.goals_for || 0) + (match.goals_against || 0);
      } else if (candidate.period === 'HT' || candidate.period === '2H') {
        const ht = htScores[match.fixture_id];
        if (ht) {
          isValid = true;
          const htHome = ht.ht_home ?? 0, htAway = ht.ht_away ?? 0;
          const ftHome = match.goals_for || 0, ftAway = match.goals_against || 0;
          const teamHT = match.is_home ? htHome : htAway;
          const oppHT  = match.is_home ? htAway : htHome;
          if (candidate.period === 'HT') {
            actualValue = htHome + htAway; // TOTAL for away loop
          } else {
            actualValue = (ftHome - teamHT) + (ftAway - oppHT);
          }
        }
      }
    } else if (candidate.stat === 'ESCANTEIOS') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'HT') { if (tot && tot.corners_ht != null) { actualValue = tot.corners_ht; isValid = true; } }
      else { if (tot && tot.corners != null) { actualValue = tot.corners; isValid = true; } }
    } else if (candidate.stat === 'CARTÕES') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'HT') { if (tot && tot.cards_ht != null) { actualValue = tot.cards_ht; isValid = true; } }
      else { if (tot && tot.cards != null) { actualValue = tot.cards; isValid = true; } }
    } else if (candidate.stat === 'IMPEDIMENTOS') {
      const tot = matchTotals[match.fixture_id];
      if (tot && tot.offsides != null) { actualValue = tot.offsides; isValid = true; }
    } else if (candidate.stat === 'CHUTES_GOL') {
      const tot = matchTotals[match.fixture_id];
      if (tot?.shots_on_goal_count >= 2) { actualValue = tot.shots_on_goal; isValid = true; }
    } else if (candidate.stat === 'CHUTES_TOTAL') {
      const tot = matchTotals[match.fixture_id];
      if (tot?.shots_total_count >= 2) { actualValue = tot.shots_total; isValid = true; }
    } else if (candidate.stat === 'AMBOS_MARCAM') {
      if (candidate.period === 'FT') {
        if (match.goals_for != null && match.goals_against != null) {
          isValid = true; actualValue = (match.goals_for > 0 && match.goals_against > 0) ? 1 : 0;
        }
      } else if (candidate.period === 'HT') {
        const ht = htScores[match.fixture_id];
        if (ht) { isValid = true; actualValue = (ht.ht_home > 0 && ht.ht_away > 0) ? 1 : 0; }
      } else if (candidate.period === '2H') {
        const ht = htScores[match.fixture_id];
        if (ht && match.goals_for != null) {
          isValid = true;
          const teamHT = match.is_home ? (ht.ht_home ?? 0) : (ht.ht_away ?? 0);
          const oppHT  = match.is_home ? (ht.ht_away ?? 0) : (ht.ht_home ?? 0);
          actualValue = ((match.goals_for - teamHT) > 0 && (match.goals_against - oppHT) > 0) ? 1 : 0;
        }
      }
    } else if (candidate.stat === 'DUPLA_CHANCE') {
      if (match.goals_for != null && match.goals_against != null) {
        isValid = true;
        const hG = match.is_home ? match.goals_for : match.goals_against;
        const aG = match.is_home ? match.goals_against : match.goals_for;
        if (candidate.type === 'HD') actualValue = hG >= aG ? 1 : 0;
        else if (candidate.type === 'HA') actualValue = hG !== aG ? 1 : 0;
        else actualValue = aG >= hG ? 1 : 0;
      }
    } else if (candidate.stat === 'RESULTADO_HT') {
      const ht = htScores[match.fixture_id];
      if (ht) { isValid = true; const o = ht.ht_home > ht.ht_away ? 'H' : ht.ht_home < ht.ht_away ? 'A' : 'D'; actualValue = o === candidate.type ? 1 : 0; }
    } else if (candidate.stat === 'RESULTADO_2H') {
      const ht = htScores[match.fixture_id];
      if (ht && match.goals_for != null) {
        isValid = true;
        const ftH = match.is_home ? match.goals_for : match.goals_against;
        const ftA = match.is_home ? match.goals_against : match.goals_for;
        const h2H = (ftH || 0) - (ht.ht_home ?? 0), a2H = (ftA || 0) - (ht.ht_away ?? 0);
        const o = h2H > a2H ? 'H' : h2H < a2H ? 'A' : 'D';
        actualValue = o === candidate.type ? 1 : 0;
      }
    }

    if (isValid) {
      awayValid++;
      if (candidate.type === 'OVER' && actualValue > candidate.threshold) awayHits++;
      else if (candidate.type === 'UNDER' && actualValue < candidate.threshold) awayHits++;
      else if (['YES','H','D','A','HD','HA','DA'].includes(candidate.type) && actualValue === 1) awayHits++;
      else if (candidate.type === 'NO' && actualValue === 0) awayHits++;
    }
  }

  const totalValid = homeValid + awayValid;
  if (totalValid < MIN_GAMES_HISTORY) return null;
  return { pct: ((homeHits + awayHits) / totalValid) * 100, hits: homeHits + awayHits, total: totalValid };
}

function parseCandidatesFromOdds(fixtureId, homeName, awayName, oddsResponse, homeHistory, awayHistory, matchTotals, htScores = {}) {
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
      const type = m[1].toUpperCase(); 
      const threshold = parseFloat(m[2]);
      if (!pairs[threshold]) pairs[threshold] = {};
      pairs[threshold][type] = parseFloat(v.odd);
    }

    for (const [threshStr, sides] of Object.entries(pairs)) {
      const threshold = parseFloat(threshStr);
      const teamName = market.teamTarget === 'HOME' ? homeName : market.teamTarget === 'AWAY' ? awayName : 'Total';

      for (const [sideKey, odd] of Object.entries(sides)) {
        if (odd < MIN_ODD) continue;

        const candidate = {
          fixture_id: fixtureId,
          betId: bet.id,
          market: market.label,
          stat: market.stat,
          period: market.period,
          teamTarget: market.teamTarget,
          team: teamName,
          type: sideKey,
          threshold,
          line: `${sideKey === 'OVER' ? 'Mais de' : 'Menos de'} ${threshold}`,
          odd,
        };

        let prob = null;
        if (market.teamTarget === 'TOTAL') {
          prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals, htScores);
        } else if (market.teamTarget === 'HOME') {
          prob = evaluateHistoricalFrequency(candidate, homeHistory, null, matchTotals, htScores);
        } else if (market.teamTarget === 'AWAY') {
          prob = evaluateHistoricalFrequency(candidate, awayHistory, null, matchTotals, htScores);
        }

        if (prob !== null && prob.pct >= MIN_HISTORICAL_PROB) {
          candidate.probability = Math.round(prob.pct);
          candidate.histHits  = prob.hits;
          candidate.histTotal = prob.total;
          candidates.push(candidate);
        }
      }
    }
  }

  // YES/NO markets
  const _yesNoMarkets = [
    { betId: 8,  stat: 'AMBOS_MARCAM', period: 'FT',  teamTarget: 'TOTAL', label: 'Ambos Marcam (JT)' },
    { betId: 34, stat: 'AMBOS_MARCAM', period: 'HT',  teamTarget: 'TOTAL', label: 'Ambos Marcam (1T)' },
    { betId: 35, stat: 'AMBOS_MARCAM', period: '2H',  teamTarget: 'TOTAL', label: 'Ambos Marcam (2T)' },
    { betId: 27, stat: 'CLEAN_SHEET',  period: 'FT',  teamTarget: 'HOME',  label: 'Clean Sheet (Casa)' },
    { betId: 28, stat: 'CLEAN_SHEET',  period: 'FT',  teamTarget: 'AWAY',  label: 'Clean Sheet (Fora)' },
  ];
  for (const _m of _yesNoMarkets) {
    const _bet = (bet365.bets || []).find(b => b.id === _m.betId);
    if (!_bet) continue;
    for (const _v of (_bet.values || [])) {
      if (!['Yes', 'No'].includes(_v.value)) continue;
      const _odd = parseFloat(_v.odd);
      if (_odd < MIN_ODD) continue;
      const _type = _v.value.toUpperCase();
      const _c = {
        fixture_id: fixtureId, betId: _m.betId,
        market: _m.label, stat: _m.stat, period: _m.period, teamTarget: _m.teamTarget,
        team: _m.teamTarget === 'HOME' ? homeName : _m.teamTarget === 'AWAY' ? awayName : 'Total',
        type: _type, threshold: 0, line: _v.value === 'Yes' ? 'Sim' : 'Não', odd: _odd,
      };
      const _hist = _m.teamTarget === 'HOME' ? homeHistory : _m.teamTarget === 'AWAY' ? awayHistory : null;
      const _prob = evaluateHistoricalFrequency(_c, _hist || homeHistory, _m.teamTarget === 'TOTAL' ? awayHistory : null, matchTotals, htScores);
      if (_prob !== null && _prob.pct >= MIN_HISTORICAL_PROB) {
        candidates.push({ ..._c, probability: Math.round(_prob.pct), histHits: _prob.hits, histTotal: _prob.total });
      }
    }
  }

  // RESULT markets (1x2 type)
  const _outcomeMap = {
    'Home':       { type: 'H',  teamTarget: 'HOME',  team: homeName, line: `Vitória ${homeName}` },
    'Draw':       { type: 'D',  teamTarget: 'TOTAL', team: 'Empate', line: 'Empate' },
    'Away':       { type: 'A',  teamTarget: 'AWAY',  team: awayName, line: `Vitória ${awayName}` },
    'Home/Draw':  { type: 'HD', teamTarget: 'TOTAL', team: 'Total', line: `${homeName} ou Empate` },
    'Home/Away':  { type: 'HA', teamTarget: 'TOTAL', team: 'Total', line: 'Vitória Qualquer' },
    'Draw/Away':  { type: 'DA', teamTarget: 'TOTAL', team: 'Total', line: `${awayName} ou Empate` },
  };
  const _resultMarkets = [
    { betId: 3,  stat: 'RESULTADO_2H', period: '2H', label: 'Vencedor 2T' },
    { betId: 12, stat: 'DUPLA_CHANCE', period: 'FT', label: 'Dupla Chance' },
    { betId: 13, stat: 'RESULTADO_HT', period: 'HT', label: 'Vencedor 1T' },
  ];
  for (const _rm of _resultMarkets) {
    const _bet = (bet365.bets || []).find(b => b.id === _rm.betId);
    if (!_bet) continue;
    for (const _v of (_bet.values || [])) {
      const _map = _outcomeMap[_v.value];
      if (!_map) continue;
      const _odd = parseFloat(_v.odd);
      if (_odd < MIN_ODD) continue;
      const _c = {
        fixture_id: fixtureId, betId: _rm.betId,
        market: _rm.label, stat: _rm.stat, period: _rm.period,
        teamTarget: _map.teamTarget, team: _map.team,
        type: _map.type, threshold: 0, line: _map.line, odd: _odd,
      };
      const _ah = _map.teamTarget === 'HOME' ? homeHistory : _map.teamTarget === 'AWAY' ? awayHistory : homeHistory;
      const _aw = _map.teamTarget === 'TOTAL' ? awayHistory : null;
      const _prob = evaluateHistoricalFrequency(_c, _ah, _aw, matchTotals, htScores);
      if (_prob !== null && _prob.pct >= MIN_HISTORICAL_PROB) {
        candidates.push({ ..._c, probability: Math.round(_prob.pct), histHits: _prob.hits, histTotal: _prob.total });
      }
    }
  }

  // GOLS_SOFRIDOS: mesmos mercados de gols, avaliados pelo goals_against do time que sofre
  // Ex: market 17 (gols fora) avaliado pelo homeHistory.goals_against = gols sofridos pelo mandante
  const sofridosMap = [
    { betId: 17,  label: 'Gols Sofridos (Casa)',    period: 'FT',  teamTarget: 'HOME', team: homeName, hist: homeHistory },
    { betId: 16,  label: 'Gols Sofridos (Fora)',    period: 'FT',  teamTarget: 'AWAY', team: awayName, hist: awayHistory },
    { betId: 106, label: 'Gols Sofridos 1T (Casa)', period: 'HT',  teamTarget: 'HOME', team: homeName, hist: homeHistory },
    { betId: 105, label: 'Gols Sofridos 1T (Fora)', period: 'HT',  teamTarget: 'AWAY', team: awayName, hist: awayHistory },
    { betId: 108, label: 'Gols Sofridos 2T (Casa)', period: '2H',  teamTarget: 'HOME', team: homeName, hist: homeHistory },
    { betId: 107, label: 'Gols Sofridos 2T (Fora)', period: '2H',  teamTarget: 'AWAY', team: awayName, hist: awayHistory },
  ];
  for (const m of sofridosMap) {
    const bet = (bet365.bets || []).find(b => b.id === m.betId);
    if (!bet) continue;
    const pairs = {};
    for (const v of (bet.values || [])) {
      const match = v.value.match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!match) continue;
      const type = match[1].toUpperCase(), threshold = parseFloat(match[2]);
      if (!pairs[threshold]) pairs[threshold] = {};
      pairs[threshold][type] = parseFloat(v.odd);
    }
    for (const [tStr, sides] of Object.entries(pairs)) {
      const threshold = parseFloat(tStr);
      for (const [type, odd] of Object.entries(sides)) {
        if (odd < MIN_ODD) continue;
        const candidate = {
          fixture_id: fixtureId, betId: m.betId,
          market: m.label, stat: 'GOLS_SOFRIDOS',
          period: m.period, teamTarget: m.teamTarget, team: m.team,
          type, threshold,
          line: `${type === 'OVER' ? 'Mais de' : 'Menos de'} ${threshold}`,
          odd,
        };
        const prob = evaluateHistoricalFrequency(candidate, m.hist, null, matchTotals, htScores);
        if (prob !== null && prob.pct >= MIN_HISTORICAL_PROB) {
          candidate.probability = Math.round(prob.pct);
          candidate.histHits = prob.hits;
          candidate.histTotal = prob.total;
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates;
}

const ANCHOR_MIN_ODD = 1.70; // Âncora precisa ter odd ≥ 1.70 para priorizar chutes sobre cartões

function buildAccumulator(allCandidates, maxPicksPerMatch = MAX_PICKS_PER_MATCH_DEFAULT) {
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

    // Evita sobreposição: mesmo stat + teamTarget + período no mesmo jogo
    const hasOverlap = selected.some(s =>
      s.fixture_id === candidate.fixture_id &&
      s.stat === candidate.stat &&
      s.teamTarget === candidate.teamTarget &&
      s.period === candidate.period
    );
    if (hasOverlap) return false;

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

  // PASSO 1: seleciona pick âncora (melhor score com odd >= ANCHOR_MIN_ODD)
  const anchorCandidates = deduped
    .filter(c => canAdd(c) && c.odd >= ANCHOR_MIN_ODD && currentOdd * c.odd <= TARGET_HIGH)
    .sort((a, b) => {
      const scoreA = a.probability + (a.odd - 1.0) * 15;
      const scoreB = b.probability + (b.odd - 1.0) * 15;
      return scoreB - scoreA;
    });
  if (anchorCandidates.length > 0) {
    doAdd(anchorCandidates[0]);
    console.log(`  ⚓ Âncora: [${anchorCandidates[0].probability}%] ${anchorCandidates[0].line} ${anchorCandidates[0].market} @ ${anchorCandidates[0].odd}`);
  }

  // PASSO 2: preenche com picks de alto score até atingir TARGET_LOW
  while (selected.length < MAX_PICKS) {
    if (currentOdd >= TARGET_LOW && selected.length >= MIN_PICKS) break;

    const available = deduped.filter(c => canAdd(c) && currentOdd * c.odd <= TARGET_HIGH);
    if (available.length === 0) break;

    available.sort((a, b) => {
      const scoreA = a.probability + (a.odd - 1.0) * 15;
      const scoreB = b.probability + (b.odd - 1.0) * 15;
      return scoreB - scoreA;
    });

    doAdd(available[0]);
  }

  if (currentOdd < TARGET_LOW && selected.length < MAX_PICKS) {
    const maxAllowed = TARGET_HIGH + 0.15;
    const fallbacks = deduped
      .filter(c => canAdd(c))
      .filter(c => (currentOdd * c.odd) >= TARGET_LOW && (currentOdd * c.odd) <= maxAllowed)
      .sort((a, b) => b.probability - a.probability || b.odd - a.odd);

    if (fallbacks.length > 0) doAdd(fallbacks[0]);
  }

  return { selected, total: currentOdd };
}

function analyzeMatchMotivation(homeApiId, awayApiId, leagueStandings) {
  if (!leagueStandings || leagueStandings.length === 0) return 'NORMAL';
  const totalTeams = leagueStandings.length;
  if (totalTeams < 10) return 'NORMAL';
  
  leagueStandings.sort((a, b) => a.rank - b.rank);
  const homeTeam = leagueStandings.find(s => s.team_api_id === homeApiId);
  const awayTeam = leagueStandings.find(s => s.team_api_id === awayApiId);
  if (!homeTeam || !awayTeam) return 'NORMAL';
  
  const maxPlayed = Math.max(...leagueStandings.map(s => s.played));
  let assumedTotalMatches = (totalTeams - 1) * 2;
  if (assumedTotalMatches < maxPlayed) assumedTotalMatches = maxPlayed + 2;
  
  const isLateSeason = (homeTeam.played / assumedTotalMatches) >= 0.85;
  if (!isLateSeason) return 'NORMAL';
  
  const pointsRank6 = leagueStandings[5]?.points || 0;
  const pointsRank18 = leagueStandings[totalTeams - 3]?.points || 0;
  
  function getTeamMotivation(team) {
    let matchesLeft = assumedTotalMatches - team.played;
    if (matchesLeft <= 0) matchesLeft = 0;
    const maxPoints = team.points + (matchesLeft * 3);
    
    if (team.rank <= 6) return 'FIGHTING';
    if (team.rank >= totalTeams - 2) return 'FIGHTING';
    
    const canReachG6 = maxPoints >= pointsRank6;
    const canBeRelegated = (team.points - pointsRank18) <= (matchesLeft * 3);
    
    if (canReachG6 || canBeRelegated) return 'FIGHTING';
    return 'SAFE';
  }
  
  const homeMot = getTeamMotivation(homeTeam);
  const awayMot = getTeamMotivation(awayTeam);
  
  if (homeMot === 'SAFE' && awayMot === 'SAFE') return 'DEAD_RUBBER';
  if (homeMot === 'FIGHTING' || awayMot === 'FIGHTING') return 'DECISIVE';
  return 'NORMAL';
}

async function generateOdd2() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  let today = process.argv[2];
  if (!today || today === '--force') today = brt.toISOString().split('T')[0];
  console.log(`\n=== Gerando Bilhete Odd 2.0 (Classic Lucrative) para ${today} ===\n`);

  // ── Guard: não sobrescrever bilhete existente ──
  const { data: existing } = await supabase
    .from('odd_tickets')
    .select('date, status')
    .eq('date', today)
    .eq('mode', '2.0')
    .maybeSingle();

  if (existing) {
    console.log(`⚠️  Bilhete 2.0 para ${today} já existe (status: ${existing.status}). Geração cancelada.`);
    console.log('   Use --force como argumento extra para forçar regereção.');
    if (!process.argv.includes('--force')) return;
    console.log('   --force detectado. Regerando...\n');
  }

  const { data: leagues } = await supabase.from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  let query = supabase
    .from('fixtures')
    .select('api_id, date, status, season, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name, logo_url), away_team:teams!fixtures_away_team_id_fkey(api_id, name, logo_url), league:leagues!fixtures_league_id_fkey(id, api_id, name, logo_url)')
    .gte('date', `${today} 00:00:00`)
    .lte('date', `${today} 23:59:59`);
  
  if (today === brtNow) {
    query = query.in('status', ['NS', 'TBD']);
  }
  const { data: fixtures } = await query;

  const candidates = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`Fixtures disponíveis: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nenhum fixture não-iniciado encontrado para hoje. Abortando.');
    return;
  }

  // Fetch standings for active leagues
  const uniqueLeagueIds = [...new Set(candidates.map(c => c.league?.id))].filter(Boolean);
  const { data: standingsData } = await supabase.from('standings').select('*').in('league_id', uniqueLeagueIds);
  const standingsByLeague = {};
  if (standingsData) {
    for (const row of standingsData) {
      if (!standingsByLeague[row.league_id]) standingsByLeague[row.league_id] = [];
      standingsByLeague[row.league_id].push(row);
    }
  }

  const allPickCandidates = [];
  for (const f of candidates) {
    const homeName = f.home_team?.name || 'Casa';
    const awayName = f.away_team?.name || 'Fora';
    process.stdout.write(`  ${homeName} x ${awayName} ... `);

    try {
      const { data: homeHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.home_team.api_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', true);
      const { data: awayHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.away_team.api_id).eq('season', f.season).eq('league_id', f.league.api_id).eq('is_home', false);

      const matchTotals = {};
      
      if (homeHistory?.length > 0 || awayHistory?.length > 0) {
         const historyFixtures = [...(homeHistory||[]), ...(awayHistory||[])].map(h => h.fixture_id);
         const { data: opponentsData } = await supabase.from('teams_history')
           .select('fixture_id, corners, shots_total, shots_on_goal, offsides, goalkeeper_saves, stats_ft, stats_1h')
           .in('fixture_id', historyFixtures);

         for (const row of (opponentsData || [])) {
           if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, corners_ht: 0, cards: 0, cards_ht: 0, shots_on_goal: 0, shots_on_goal_count: 0, shots_total: 0, offsides: 0, goalkeeper_saves: 0 };
           matchTotals[row.fixture_id].corners += (row.corners || 0);
           const ck_ht = row.stats_1h?.find(s => s.type === 'Corner Kicks');
           matchTotals[row.fixture_id].corners_ht += (ck_ht?.value || 0);
           const y    = row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
           const r    = row.stats_ft?.find(s => s.type === 'Red Cards')?.value   || 0;
           const y1h  = row.stats_1h?.find(s => s.type === 'Yellow Cards')?.value || 0;
           const r1h  = row.stats_1h?.find(s => s.type === 'Red Cards')?.value   || 0;
           matchTotals[row.fixture_id].cards    += (y + r);
           matchTotals[row.fixture_id].cards_ht += (y1h + r1h);
           if (row.shots_total      != null) { matchTotals[row.fixture_id].shots_total      += row.shots_total;      matchTotals[row.fixture_id].shots_total_count      = (matchTotals[row.fixture_id].shots_total_count      || 0) + 1; }
           if (row.shots_on_goal   != null) { matchTotals[row.fixture_id].shots_on_goal   += row.shots_on_goal;   matchTotals[row.fixture_id].shots_on_goal_count   = (matchTotals[row.fixture_id].shots_on_goal_count   || 0) + 1; }
           if (row.offsides        != null) { matchTotals[row.fixture_id].offsides        += row.offsides; }
           if (row.goalkeeper_saves!= null) { matchTotals[row.fixture_id].goalkeeper_saves += row.goalkeeper_saves; }
         }
      }

       // Fetch HT scores from fixtures table for reliable HT/2H goal evaluation
       const htScores = {};
       if (homeHistory?.length > 0 || awayHistory?.length > 0) {
         const historyFixtureIds = [...new Set([...(homeHistory||[]), ...(awayHistory||[])].map(h => h.fixture_id))];
         const { data: fixtureRows } = await supabase
           .from('fixtures')
           .select('api_id, ht_home_score, ht_away_score')
           .in('api_id', historyFixtureIds);
         for (const fr of (fixtureRows || [])) {
           if (fr.ht_home_score != null) {
             htScores[fr.api_id] = { ht_home: fr.ht_home_score, ht_away: fr.ht_away_score };
           }
         }
       }

      const oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}&bookmaker=${BOOKMAKER_ID}`);
      
      const picks = parseCandidatesFromOdds(f.api_id, homeName, awayName, oddsResp, homeHistory, awayHistory, matchTotals, htScores);
      
      const leagueStandings = standingsByLeague[f.league?.id] || [];
      const motivation = analyzeMatchMotivation(f.home_team.api_id, f.away_team.api_id, leagueStandings);
      
      let filteredPicks = picks;
      if (motivation === 'DEAD_RUBBER') {
        filteredPicks = picks.filter(p => !(p.stat === 'CARTÕES' && p.type === 'OVER'));
        const diff = picks.length - filteredPicks.length;
        if (diff > 0) console.log(`   [Motivation] Jogo 'Amistoso' (Sem meta): ${diff} pick(s) de OVER Cartões bloqueadas.`);
      } else if (motivation === 'DECISIVE') {
        console.log(`   [Motivation] Jogo Decisivo! (Title/Relegation/Europe)`);
      }
      
      if ((homeHistory?.length || 0) < MIN_GAMES_HISTORY || (awayHistory?.length || 0) < MIN_GAMES_HISTORY) {
         console.log(`Ignorado (Amostragem: Casa ${homeHistory?.length || 0}, Fora ${awayHistory?.length || 0} jogos)`);
         continue;
      } else {
         console.log(`${filteredPicks.length} candidato(s) EV+`);
      }
      
      allPickCandidates.push(...filteredPicks.map(p => ({
        ...p,
        home: homeName,
        away: awayName,
        homeLogo: f.home_team?.logo_url || '',
        awayLogo: f.away_team?.logo_url || '',
        date_time: f.date,
        leagueName: f.league?.name || '',
        leagueLogo: f.league?.logo_url || '',
      })));
      await delay(800);
    } catch (e) {
      console.log(`erro: ${e.message}`);
    }
  }

  console.log(`\nTotal de candidatos (EV+): ${allPickCandidates.length}`);

  if (allPickCandidates.length < MIN_PICKS) {
    console.log('Odds insuficientes disponíveis. Salvando bilhete vazio.');
    await supabase.from('odd_tickets').upsert({
      date: today,
      mode: '2.0',
      matches_count: 0, total_odd: '1.00',
      status: 'PENDING',
      ticket_data: { entries: [], confidence_score: 0, generated_at: new Date().toISOString() }
    }, { onConflict: 'date,mode' });
    return;
  }

  const uniqueFixtures = new Set(allPickCandidates.map(c => c.fixture_id));
  const maxPerMatch = uniqueFixtures.size <= 4 ? MAX_PICKS_PER_MATCH_FEW_GAMES : MAX_PICKS_PER_MATCH_DEFAULT;
  const { selected, total } = buildAccumulator(allPickCandidates, maxPerMatch);
  
  const avgProb = selected.length ? Math.round(selected.reduce((acc, p) => acc + p.probability, 0) / selected.length) : 0;
  
  if (total < 1.50 || avgProb < 80) {
    console.log(`\n⚠️ Requisitos não atingidos: Odd Final = ${total.toFixed(2)} (Min: 1.50) | Prob. Média = ${avgProb}% (Min: 80%). Salvando bilhete vazio.`);
    await supabase.from('odd_tickets').upsert({
      date: today,
      mode: '2.0',
      matches_count: 0, total_odd: '1.00',
      status: 'PENDING',
      ticket_data: { entries: [], confidence_score: 0, generated_at: new Date().toISOString() }
    }, { onConflict: 'date,mode' });
    return;
  }
  
  console.log(`\nPicks selecionados: ${selected.length} | Odd total: ${total.toFixed(2)} | Prob Média: ${avgProb}%`);

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
        league_name: pick.leagueName,
        league_logo_url: pick.leagueLogo,
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
      histHits:    pick.histHits,
      histTotal:   pick.histTotal,
      market: pick.market,
    });
  }

  const entries = Object.values(entriesMap);
  const allPicks = entries.flatMap(e => e.picks);
  const avgConfidence = Math.round(allPicks.reduce((a, b) => a + b.probability, 0) / allPicks.length);
  const totalOdd = allPicks.reduce((a, b) => a * b.odd, 1.0);

  console.log('\n── BILHETE GERADO ──');
  for (const e of entries) {
    console.log(`\n  ${e.home} x ${e.away}`);
    for (const p of e.picks) {
      console.log(`    [${p.probability}% Hist.] ${p.team}: ${p.line} ${p.stat} (${p.period}) → odd ${p.odd} [${p.market}]`);
    }
  }
  console.log(`\n  Odd Total: ${totalOdd.toFixed(2)}`);
  console.log(`  Confiança Média Histórica: ${avgConfidence}%`);

  if (process.argv.includes('--preview')) {
    console.log('\n👀 MODO PREVIEW: O bilhete acima NÃO foi salvo no banco.');
    return;
  }

  await supabase.from('odd_tickets').upsert({
    date: today,
    mode: '2.0',
    matches_count: entries.length,
    total_odd: totalOdd.toFixed(2),
    status: 'PENDING',
    ticket_data: {
      entries,
      confidence_score: avgConfidence,
      generated_at: new Date().toISOString(),
    }
  }, { onConflict: 'date,mode' });

  console.log('\n✓ Bilhete salvo no banco.\n');
}

generateOdd2().catch(console.error);
