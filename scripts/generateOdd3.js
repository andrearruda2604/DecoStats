/**
 * Bilhete Odd 3.0 — odds reais da Bet365 via API-Football
 * Alvo: múltipla ~3.00 usando picks de ALTA PROBABILIDADE HISTÓRICA
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

const TARGET_LOW  = 2.80;
const TARGET_HIGH = 3.00;
const MIN_PICKS   = 4;
const MAX_PICKS   = 12; 
const MAX_PICKS_PER_MATCH_DEFAULT = 2;
const MAX_PICKS_PER_MATCH_FEW_GAMES = 3; 

const MIN_HISTORICAL_PROB = 85; 
const MIN_ODD = 1.07;        
const MIN_GAMES_HISTORY = 5; 
const BOOKMAKER_ID = 8;      

const MARKETS = {
  5:  { label: 'Gols JOGO (Total)',        stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  16: { label: 'Gols JOGO (Casa)',         stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols JOGO (Fora)',         stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
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
  267:{ label: 'Defesas de Goleiro',    stat: 'DEFESAS',      period: 'FT', teamTarget: 'TOTAL' },
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
        const ht = htScores[match.fixture_id];
        if (ht) {
          isValid = true;
          const htHome = ht.ht_home ?? 0, htAway = ht.ht_away ?? 0;
          const ftHome = match.goals_for || 0, ftAway = match.goals_against || 0;
          const teamHT = match.is_home ? htHome : htAway;
          const oppHT  = match.is_home ? htAway : htHome;
          if (candidate.period === 'HT') {
            if (candidate.teamTarget === 'TOTAL') actualValue = htHome + htAway;
            else if (candidate.teamTarget === 'HOME') actualValue = teamHT;
            else actualValue = oppHT;
          } else {
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
    } else if (candidate.stat === 'DEFESAS') {
      if (candidate.period === 'HT') {
        const s = match.stats_1h?.find(s => s.type === 'Goalkeeper Saves');
        if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.goalkeeper_saves != null) { actualValue = tot.goalkeeper_saves; isValid = true; }
        } else {
          if (match.goalkeeper_saves != null) { 
            actualValue = match.goalkeeper_saves; isValid = true; 
          } else {
            const s = match.stats_ft?.find(s => s.type === 'Goalkeeper Saves');
            if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
          }
        }
      }
    }

    if (isValid) {
      homeValid++;
      if (candidate.type === 'OVER' && actualValue > candidate.threshold) homeHits++;
      if (candidate.type === 'UNDER' && actualValue < candidate.threshold) homeHits++;
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
            actualValue = htHome + htAway;
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
    } else if (candidate.stat === 'CHUTES_GOL' || candidate.stat === 'CHUTES_TOTAL' || candidate.stat === 'IMPEDIMENTOS' || candidate.stat === 'DEFESAS') {
      continue; 
    }

    if (isValid) {
      awayValid++;
      if (candidate.type === 'OVER' && actualValue > candidate.threshold) awayHits++;
      if (candidate.type === 'UNDER' && actualValue < candidate.threshold) awayHits++;
    }
  }

  const totalValid = homeValid + awayValid;
  if (totalValid < MIN_GAMES_HISTORY) return null;
  return { pct: ((homeHits + awayHits) / totalValid) * 100, hits: homeHits + awayHits, total: totalValid };
}

function parseCandidatesFromOdds(fixtureId, homeName, awayName, oddsResp, homeHistory, awayHistory, matchTotals, forbiddenPicks = new Set(), htScores = {}) {
  if (!oddsResp || oddsResp.length === 0) return [];
  // Prioriza Bet365, mas faz fallback para outras casas se não encontrar
  const allBookmakers = (oddsResp || []).flatMap(r => r.bookmakers || []);
  const bet365 = allBookmakers.find(b => b.id === BOOKMAKER_ID);
  const fallbackBookmaker = !bet365 ? allBookmakers[0] : null;
  const bookmaker = bet365 || fallbackBookmaker;
  if (!bookmaker) return [];
  if (fallbackBookmaker) console.log(`    ⚠️ Bet365 indisponível, usando ${fallbackBookmaker.name || 'casa alternativa'} (id: ${fallbackBookmaker.id})`);

  const candidates = [];

  for (const bet of (bookmaker.bets || [])) {
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

          // Verificar se esta entrada já está no bilhete 2.0
          const forbiddenKey = `${candidate.fixture_id}|${candidate.stat}|${candidate.period}|${candidate.line}`.toUpperCase();
          if (forbiddenPicks.has(forbiddenKey)) {
            console.log(`      [Diversificação] Ignorado 3.0 (já está no 2.0): ${candidate.market} ${candidate.line}`);
          } else {
            candidates.push(candidate);
          }
        }
      }
    }
  }

  return candidates;
}

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

    // Evita sobreposição (ex: Menos de 3.5 e Menos de 4.5 do mesmo time no mesmo jogo)
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

  while (selected.length < MAX_PICKS) {
    if (currentOdd >= TARGET_LOW && selected.length >= MIN_PICKS) break;

    // Remove forced diversification to prioritize strict highest % and odd
    const available = deduped.filter(c => canAdd(c) && currentOdd * c.odd <= TARGET_HIGH);
    if (available.length === 0) break;

    available.sort((a, b) => {
      const scoreA = a.probability + (a.contextBonus || 0);
      const scoreB = b.probability + (b.contextBonus || 0);
      return scoreB - scoreA || a.odd - b.odd;
    });
    const pick = available[0];

    doAdd(pick);
  }

  if (currentOdd < TARGET_LOW && selected.length < MAX_PICKS) {
    const maxAllowed = TARGET_HIGH + 0.15;
    const fallbacks = deduped
      .filter(c => canAdd(c))
      .filter(c => (currentOdd * c.odd) >= TARGET_LOW && (currentOdd * c.odd) <= maxAllowed)
      .sort((a, b) => {
        const scoreA = a.probability + (a.contextBonus || 0);
        const scoreB = b.probability + (b.contextBonus || 0);
        return scoreB - scoreA || b.odd - a.odd;
      });

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
  
  function getTeamMotivation(team) {
    function canOvertake(hunter, target) {
      const matchesLeftHunter = Math.max(0, assumedTotalMatches - hunter.played);
      const hunterMaxPoints = hunter.points + (matchesLeftHunter * 3);
      if (hunterMaxPoints > target.points) return true;
      if (hunterMaxPoints === target.points) {
        const hunterProjectedGD = (hunter.goal_diff || 0) + matchesLeftHunter;
        if (hunterProjectedGD >= (target.goal_diff || 0)) return true;
      }
      return false;
    }

    const rank1 = leagueStandings[0];
    const rank2 = leagueStandings[1];
    if (rank1 && rank2) {
      if (team.team_api_id === rank1.team_api_id) {
         if (canOvertake(rank2, team)) return 'FIGHTING';
      } else {
         if (canOvertake(team, rank1)) return 'FIGHTING';
      }
    }

    const rank4 = leagueStandings[3];
    const rank5 = leagueStandings[4];
    if (rank4 && rank5) {
      if (team.rank <= 4) {
         if (canOvertake(rank5, team)) return 'FIGHTING';
      } else {
         if (canOvertake(team, rank4)) return 'FIGHTING';
      }
    }

    const rank6 = leagueStandings[5];
    const rank7 = leagueStandings[6];
    if (rank6 && rank7) {
      if (team.rank <= 6) {
         if (canOvertake(rank7, team)) return 'FIGHTING';
      } else {
         if (canOvertake(team, rank6)) return 'FIGHTING';
      }
    }

    const safeRank = leagueStandings[totalTeams - 4];
    const relRank = leagueStandings[totalTeams - 3];
    if (safeRank && relRank) {
      if (team.rank <= totalTeams - 3) {
         if (canOvertake(relRank, team)) return 'FIGHTING';
      } else {
         if (canOvertake(team, safeRank)) return 'FIGHTING';
      }
    }

    return 'SAFE';
  }
  
  const homeMot = getTeamMotivation(homeTeam);
  const awayMot = getTeamMotivation(awayTeam);
  
  if (homeMot === 'SAFE' && awayMot === 'SAFE') return 'DEAD_RUBBER';
  if (homeMot === 'FIGHTING' || awayMot === 'FIGHTING') return 'DECISIVE';
  return 'NORMAL';
}

async function generateOdd3() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  let today = process.argv[2];
  if (!today || today === '--force') today = brt.toISOString().split('T')[0];
  console.log(`\n=== Gerando Bilhete Odd 3.0 para ${today} ===\n`);

  // ── Guard: não sobrescrever bilhete existente ──
  const { data: existing } = await supabase
    .from('odd_tickets')
    .select('date, status')
    .eq('date', today)
    .eq('mode', '3.0')
    .maybeSingle();

  if (existing) {
    console.log(`⚠️  Bilhete 3.0 para ${today} já existe (status: ${existing.status}). Geração cancelada.`);
    console.log('   Use --force como argumento extra para forçar regereção.');
    if (!process.argv.includes('--force')) return;
    console.log('   --force detectado. Regerando...\n');
  }

  const { data: leagues } = await supabase.from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextDate = new Date(`${today}T03:00:00Z`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19);

  let query = supabase
    .from('fixtures')
    .select('api_id, date, status, season, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name, logo_url), away_team:teams!fixtures_away_team_id_fkey(api_id, name, logo_url), league:leagues!fixtures_league_id_fkey(id, api_id, name, logo_url)')
    .gte('date', `${today} 03:00:00`)
    .lte('date', endDateStr);

  if (today === brtNow) {
    query = query.in('status', ['NS', 'TBD']);
  }
  const { data: fixtures } = await query;

  const candidates = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`Fixtures disponíveis: ${candidates.length}`);

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

  // ── Buscar bilhete 2.0 para evitar duplicidade de entrada ──
  const { data: ticket20 } = await supabase
    .from('odd_tickets')
    .select('ticket_data')
    .eq('date', today)
    .eq('mode', '2.0')
    .maybeSingle();

  const forbiddenPicks = new Set();
  if (ticket20?.ticket_data?.entries) {
    for (const entry of ticket20.ticket_data.entries) {
      if (!entry.picks) continue;
      for (const pick of entry.picks) {
        // Chave: fixture_id | stat | period | line (normalizado)
        const key = `${entry.fixture_id}|${pick.stat}|${pick.period}|${pick.line}`.toUpperCase();
        forbiddenPicks.add(key);
      }
    }
  }

  if (candidates.length === 0) {
    console.log('Nenhum fixture não-iniciado encontrado para hoje. Abortando.');
    return;
  }

  const allPickCandidates = [];
  for (const f of candidates) {
    const homeName = f.home_team?.name || 'Casa';
    const awayName = f.away_team?.name || 'Fora';

    // Bloqueio manual do El Clássico e Fixtures do Bilhete 2.0
    if (f.api_id === 1391161) {
      console.log(`  ${homeName} x ${awayName} ... Ignorado (Manual: Sem El Clássico)`);
      continue;
    }

    // Bloqueio manual da Champions League (api_id 2)
    if (f.league?.api_id === 2) {
      console.log(`  ${homeName} x ${awayName} ... Ignorado (Manual: Champions League - Final)`);
      continue;
    }

    try {
      const { data: homeHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.home_team.api_id).eq('season', f.season).eq('league_id', f.league.id).eq('is_home', true);
      const { data: awayHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.away_team.api_id).eq('season', f.season).eq('league_id', f.league.id).eq('is_home', false);

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
           const y   = row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
           const r   = row.stats_ft?.find(s => s.type === 'Red Cards')?.value   || 0;
           const y1h = row.stats_1h?.find(s => s.type === 'Yellow Cards')?.value || 0;
           const r1h = row.stats_1h?.find(s => s.type === 'Red Cards')?.value   || 0;
           matchTotals[row.fixture_id].cards    += (y + r);
           matchTotals[row.fixture_id].cards_ht += (y1h + r1h);
           matchTotals[row.fixture_id].shots_total = (matchTotals[row.fixture_id].shots_total || 0) + (row.shots_total || 0);
           matchTotals[row.fixture_id].offsides = (matchTotals[row.fixture_id].offsides || 0) + (row.offsides || 0);
           matchTotals[row.fixture_id].goalkeeper_saves = (matchTotals[row.fixture_id].goalkeeper_saves || 0) + (row.goalkeeper_saves || 0);
           
           if (row.shots_on_goal != null) {
             matchTotals[row.fixture_id].shots_on_goal += row.shots_on_goal;
             matchTotals[row.fixture_id].shots_on_goal_count++;
           }
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

      let oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}`);
      
      // MOCK FORTALEZA x PONTE PRETA
      if (f.api_id === 1520754 && (!oddsResp || oddsResp.length === 0)) {
        oddsResp = [
          {
            bookmakers: [
              {
                id: 8,
                bets: [
                  {
                    id: 57, // Escanteios JOGO (Casa)
                    values: [
                      { value: 'Under 5.5', odd: '2.62' },
                      { value: 'Under 6.5', odd: '1.83' }
                    ]
                  },
                  {
                    id: 12, // Dupla Chance
                    values: [
                      { value: 'Home/Away', odd: '1.16' }
                    ]
                  }
                ]
              }
            ]
          }
        ];
      }

      const picks = parseCandidatesFromOdds(f.api_id, homeName, awayName, oddsResp, homeHistory, awayHistory, matchTotals, forbiddenPicks, htScores);
      
      const leagueStandings = standingsByLeague[f.league?.id] || [];
      const motivation = analyzeMatchMotivation(f.home_team.api_id, f.away_team.api_id, leagueStandings);
      
      let filteredPicks = picks;
      if (motivation === 'DEAD_RUBBER') {
        filteredPicks = picks.filter(p => !(p.stat === 'CARTÕES' && p.type === 'OVER'));
        filteredPicks.forEach(p => {
          if ((p.stat === 'CARTÕES' && p.type === 'UNDER') || (p.stat === 'ESCANTEIOS' && p.period === 'HT' && p.type === 'UNDER')) {
            p.contextBonus = 15;
            p.boostLabel = '🧊 Amistoso';
          }
        });
        const diff = picks.length - filteredPicks.length;
        if (diff > 0) console.log(`   [Motivation] Jogo 'Amistoso' (Sem meta): ${diff} pick(s) de OVER Cartões bloqueadas.`);
      } else if (motivation === 'DECISIVE') {
        filteredPicks = picks.filter(p => !(p.stat === 'CARTÕES' && p.type === 'UNDER'));
        filteredPicks.forEach(p => {
          if ((p.stat === 'CARTÕES' || p.stat === 'ESCANTEIOS') && p.type === 'OVER') {
            p.contextBonus = 15;
            p.boostLabel = '🔥 Alta Tensão';
          }
        });
        const diff = picks.length - filteredPicks.length;
        if (diff > 0) console.log(`   [Motivation] Jogo Decisivo (Alta Tensão): ${diff} pick(s) de UNDER Cartões bloqueadas.`);
        else console.log(`   [Motivation] Jogo Decisivo! (Title/Relegation/Europe)`);
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
        contextBonus: p.contextBonus || 0,
        boostLabel: p.boostLabel || '',
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
      mode: '3.0',
      matches_count: 0, total_odd: '1.00',
      status: 'PENDING',
      ticket_data: { entries: [], confidence_score: 0, generated_at: new Date().toISOString() }
    }, { onConflict: 'date,mode' });
    return;
  }

  const uniqueFixtures = new Set(allPickCandidates.map(c => c.fixture_id));
  const maxPerMatch = uniqueFixtures.size <= 4 ? MAX_PICKS_PER_MATCH_FEW_GAMES : MAX_PICKS_PER_MATCH_DEFAULT;
  const { selected, total } = buildAccumulator(allPickCandidates, maxPerMatch);
  
  console.log(`\nPicks selecionados: ${selected.length} | Odd total: ${total.toFixed(2)}`);

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
      contextBonus: pick.contextBonus,
      boostLabel: pick.boostLabel,
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
      const boostStr = p.boostLabel ? ` ${p.boostLabel}` : '';
      console.log(`    [${p.probability}% Hist.]${boostStr} ${p.team}: ${p.line} ${p.stat} (${p.period}) → odd ${p.odd} [${p.market}]`);
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
    mode: '3.0',
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

generateOdd3().catch(console.error);
