/**
 * Oportunidades do Dia — picks com prob ≥ 90% para qualquer jogo do dia
 * Salva em odd_tickets com mode='opp' e date=data alvo
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

const MIN_PROB        = 90;   // > 89%
const MIN_ODD         = 1.03;
const MIN_GAMES       = 5;
const BOOKMAKER_ID    = 8;    // Bet365

const MARKETS = {
  5:  { label: 'Gols JOGO (Total)',        stat: 'GOLS',       period: 'FT', teamTarget: 'TOTAL' },
  6:  { label: 'Gols 1° Tempo (Total)',    stat: 'GOLS',       period: 'HT', teamTarget: 'TOTAL' },
  26: { label: 'Gols 2° Tempo (Total)',    stat: 'GOLS',       period: '2H', teamTarget: 'TOTAL' },
  16: { label: 'Gols JOGO (Casa)',         stat: 'GOLS',       period: 'FT', teamTarget: 'HOME'  },
  17: { label: 'Gols JOGO (Fora)',         stat: 'GOLS',       period: 'FT', teamTarget: 'AWAY'  },
  105:{ label: 'Gols 1° Tempo (Casa)',     stat: 'GOLS',       period: 'HT', teamTarget: 'HOME'  },
  106:{ label: 'Gols 1° Tempo (Fora)',     stat: 'GOLS',       period: 'HT', teamTarget: 'AWAY'  },
  107:{ label: 'Gols 2° Tempo (Casa)',     stat: 'GOLS',       period: '2H', teamTarget: 'HOME'  },
  108:{ label: 'Gols 2° Tempo (Fora)',     stat: 'GOLS',       period: '2H', teamTarget: 'AWAY'  },
  45: { label: 'Escanteios JOGO (Total)',  stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'TOTAL' },
  77: { label: 'Escanteios 1° Tempo (T)',  stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'TOTAL' },
  57: { label: 'Escanteios JOGO (Casa)',   stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'HOME'  },
  58: { label: 'Escanteios JOGO (Fora)',   stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY'  },
  132:{ label: 'Escanteios 1° Tempo (C)',  stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'HOME'  },
  134:{ label: 'Escanteios 1° Tempo (F)',  stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'AWAY'  },
  80: { label: 'Cartões JOGO (Total)',     stat: 'CARTÕES',    period: 'FT', teamTarget: 'TOTAL' },
  82: { label: 'Cartões JOGO (Casa)',      stat: 'CARTÕES',    period: 'FT', teamTarget: 'HOME'  },
  83: { label: 'Cartões JOGO (Fora)',      stat: 'CARTÕES',    period: 'FT', teamTarget: 'AWAY'  },
  169:{ label: 'Cartões 1° Tempo (T)',     stat: 'CARTÕES',    period: 'HT', teamTarget: 'TOTAL' },
  170:{ label: 'Cartões 1° Tempo (C)',     stat: 'CARTÕES',    period: 'HT', teamTarget: 'HOME'  },
  171:{ label: 'Cartões 1° Tempo (F)',     stat: 'CARTÕES',    period: 'HT', teamTarget: 'AWAY'  },
  87: { label: 'Chutes ao Gol (Total)',    stat: 'CHUTES_GOL',   period: 'FT', teamTarget: 'TOTAL' },
  88: { label: 'Chutes ao Gol (Casa)',     stat: 'CHUTES_GOL',   period: 'FT', teamTarget: 'HOME'  },
  89: { label: 'Chutes ao Gol (Fora)',     stat: 'CHUTES_GOL',   period: 'FT', teamTarget: 'AWAY'  },
  211:{ label: 'Chutes Totais',            stat: 'CHUTES_TOTAL',  period: 'FT', teamTarget: 'TOTAL' },
  221:{ label: 'Chutes Totais (Casa)',     stat: 'CHUTES_TOTAL',  period: 'FT', teamTarget: 'HOME'  },
  220:{ label: 'Chutes Totais (Fora)',     stat: 'CHUTES_TOTAL',  period: 'FT', teamTarget: 'AWAY'  },
  164:{ label: 'Impedimentos (Total)',    stat: 'IMPEDIMENTOS',  period: 'FT', teamTarget: 'TOTAL' },
  167:{ label: 'Impedimentos (Casa)',     stat: 'IMPEDIMENTOS',  period: 'FT', teamTarget: 'HOME'  },
  168:{ label: 'Impedimentos (Fora)',     stat: 'IMPEDIMENTOS',  period: 'FT', teamTarget: 'AWAY'  },
};

const FALLBACK_CANDIDATES = [
  // 1x2
  { betId: 1, market: '1x2 Resultado Final', stat: 'RESULTADO', period: 'FT', teamTarget: 'HOME', type: 'H', line: 'Vitória Casa', threshold: 0 },
  { betId: 1, market: '1x2 Resultado Final', stat: 'RESULTADO', period: 'FT', teamTarget: 'TOTAL', type: 'D', line: 'Empate', threshold: 0 },
  { betId: 1, market: '1x2 Resultado Final', stat: 'RESULTADO', period: 'FT', teamTarget: 'AWAY', type: 'A', line: 'Vitória Fora', threshold: 0 },
  // Dupla Chance
  { betId: 12, market: 'Dupla Chance', stat: 'DUPLA_CHANCE', period: 'FT', teamTarget: 'TOTAL', type: 'HD', line: 'Casa ou Empate', threshold: 0 },
  { betId: 12, market: 'Dupla Chance', stat: 'DUPLA_CHANCE', period: 'FT', teamTarget: 'TOTAL', type: 'HA', line: 'Vitória Qualquer', threshold: 0 },
  { betId: 12, market: 'Dupla Chance', stat: 'DUPLA_CHANCE', period: 'FT', teamTarget: 'TOTAL', type: 'DA', line: 'Fora ou Empate', threshold: 0 },
  // Ambos Marcam
  { betId: 8, market: 'Ambos Marcam (JT)', stat: 'AMBOS_MARCAM', period: 'FT', teamTarget: 'TOTAL', type: 'YES', line: 'Sim', threshold: 0 },
  { betId: 8, market: 'Ambos Marcam (JT)', stat: 'AMBOS_MARCAM', period: 'FT', teamTarget: 'TOTAL', type: 'NO', line: 'Não', threshold: 0 },
  { betId: 34, market: 'Ambos Marcam (1T)', stat: 'AMBOS_MARCAM', period: 'HT', teamTarget: 'TOTAL', type: 'YES', line: 'Sim', threshold: 0 },
  { betId: 34, market: 'Ambos Marcam (1T)', stat: 'AMBOS_MARCAM', period: 'HT', teamTarget: 'TOTAL', type: 'NO', line: 'Não', threshold: 0 },
  { betId: 35, market: 'Ambos Marcam (2T)', stat: 'AMBOS_MARCAM', period: '2H', teamTarget: 'TOTAL', type: 'YES', line: 'Sim', threshold: 0 },
  { betId: 35, market: 'Ambos Marcam (2T)', stat: 'AMBOS_MARCAM', period: '2H', teamTarget: 'TOTAL', type: 'NO', line: 'Não', threshold: 0 },
  // Clean Sheet
  { betId: 27, market: 'Clean Sheet (Casa)', stat: 'GOLS_SOFRIDOS', period: 'FT', teamTarget: 'HOME', type: 'NO', line: 'Mais de 0.5 Gols Sofridos', threshold: 0 },
  { betId: 27, market: 'Clean Sheet (Casa)', stat: 'GOLS_SOFRIDOS', period: 'FT', teamTarget: 'HOME', type: 'YES', line: 'Menos de 0.5 Gols Sofridos', threshold: 0 },
  { betId: 28, market: 'Clean Sheet (Fora)', stat: 'GOLS_SOFRIDOS', period: 'FT', teamTarget: 'AWAY', type: 'NO', line: 'Mais de 0.5 Gols Sofridos', threshold: 0 },
  { betId: 28, market: 'Clean Sheet (Fora)', stat: 'GOLS_SOFRIDOS', period: 'FT', teamTarget: 'AWAY', type: 'YES', line: 'Menos de 0.5 Gols Sofridos', threshold: 0 },
  // Resultado HT
  { betId: 13, market: 'Vencedor 1T', stat: 'RESULTADO_HT', period: 'HT', teamTarget: 'HOME', type: 'H', line: 'Vitória Casa', threshold: 0 },
  { betId: 13, market: 'Vencedor 1T', stat: 'RESULTADO_HT', period: 'HT', teamTarget: 'TOTAL', type: 'D', line: 'Empate', threshold: 0 },
  { betId: 13, market: 'Vencedor 1T', stat: 'RESULTADO_HT', period: 'HT', teamTarget: 'AWAY', type: 'A', line: 'Vitória Fora', threshold: 0 },
];
const OVER_UNDER_MARKETS = [
  { betId: 5, market: 'Gols JOGO (Total)', stat: 'GOLS', period: 'FT', teamTarget: 'TOTAL', thresholds: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5] },
  { betId: 16, market: 'Gols JOGO (Casa)', stat: 'GOLS', period: 'FT', teamTarget: 'HOME', thresholds: [0.5, 1.5, 2.5, 3.5] },
  { betId: 17, market: 'Gols JOGO (Fora)', stat: 'GOLS', period: 'FT', teamTarget: 'AWAY', thresholds: [0.5, 1.5, 2.5, 3.5] },
  { betId: 6, market: 'Gols 1° Tempo (Total)', stat: 'GOLS', period: 'HT', teamTarget: 'TOTAL', thresholds: [0.5, 1.5, 2.5] },
  { betId: 105, market: 'Gols 1° Tempo (Casa)', stat: 'GOLS', period: 'HT', teamTarget: 'HOME', thresholds: [0.5, 1.5] },
  { betId: 106, market: 'Gols 1° Tempo (Fora)', stat: 'GOLS', period: 'HT', teamTarget: 'AWAY', thresholds: [0.5, 1.5] },
  { betId: 26, market: 'Gols 2° Tempo (Total)', stat: 'GOLS', period: '2H', teamTarget: 'TOTAL', thresholds: [0.5, 1.5, 2.5] },
  { betId: 107, market: 'Gols 2° Tempo (Casa)', stat: 'GOLS', period: '2H', teamTarget: 'HOME', thresholds: [0.5, 1.5] },
  { betId: 108, market: 'Gols 2° Tempo (Fora)', stat: 'GOLS', period: '2H', teamTarget: 'AWAY', thresholds: [0.5, 1.5] },
  { betId: 45, market: 'Escanteios JOGO (Total)', stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'TOTAL', thresholds: [7.5, 8.5, 9.5, 10.5, 11.5] },
  { betId: 57, market: 'Escanteios JOGO (Casa)', stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'HOME', thresholds: [3.5, 4.5, 5.5, 6.5] },
  { betId: 58, market: 'Escanteios JOGO (Fora)', stat: 'ESCANTEIOS', period: 'FT', teamTarget: 'AWAY', thresholds: [3.5, 4.5, 5.5, 6.5] },
  { betId: 77, market: 'Escanteios 1° Tempo (T)', stat: 'ESCANTEIOS', period: 'HT', teamTarget: 'TOTAL', thresholds: [3.5, 4.5, 5.5] },
  { betId: 80, market: 'Cartões JOGO (Total)', stat: 'CARTÕES', period: 'FT', teamTarget: 'TOTAL', thresholds: [3.5, 4.5, 5.5, 6.5] },
  { betId: 82, market: 'Cartões JOGO (Casa)', stat: 'CARTÕES', period: 'FT', teamTarget: 'HOME', thresholds: [1.5, 2.5, 3.5] },
  { betId: 83, market: 'Cartões JOGO (Fora)', stat: 'CARTÕES', period: 'FT', teamTarget: 'AWAY', thresholds: [1.5, 2.5, 3.5] },
  { betId: 87, market: 'Chutes ao Gol (Total)', stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'TOTAL', thresholds: [6.5, 7.5, 8.5, 9.5] },
  { betId: 88, market: 'Chutes ao Gol (Casa)', stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'HOME', thresholds: [3.5, 4.5, 5.5] },
  { betId: 89, market: 'Chutes ao Gol (Fora)', stat: 'CHUTES_GOL', period: 'FT', teamTarget: 'AWAY', thresholds: [3.5, 4.5, 5.5] },
  { betId: 211, market: 'Chutes Totais', stat: 'CHUTES_TOTAL', period: 'FT', teamTarget: 'TOTAL', thresholds: [19.5, 21.5, 23.5, 25.5] },
  { betId: 221, market: 'Chutes Totais (Casa)', stat: 'CHUTES_TOTAL', period: 'FT', teamTarget: 'HOME', thresholds: [10.5, 12.5, 14.5] },
  { betId: 220, market: 'Chutes Totais (Fora)', stat: 'CHUTES_TOTAL', period: 'FT', teamTarget: 'AWAY', thresholds: [9.5, 11.5, 13.5] },
  { betId: 164, market: 'Impedimentos (Total)', stat: 'IMPEDIMENTOS', period: 'FT', teamTarget: 'TOTAL', thresholds: [2.5, 3.5, 4.5] },
];
for (const m of OVER_UNDER_MARKETS) {
  for (const t of m.thresholds) {
    FALLBACK_CANDIDATES.push({
      betId: m.betId, market: m.market, stat: m.stat, period: m.period, teamTarget: m.teamTarget,
      type: 'OVER', line: `Mais de ${t}`, threshold: t
    });
    FALLBACK_CANDIDATES.push({
      betId: m.betId, market: m.market, stat: m.stat, period: m.period, teamTarget: m.teamTarget,
      type: 'UNDER', line: `Menos de ${t}`, threshold: t
    });
  }
}

async function fetchApi(url) {
  for (let i = 3; i > 0; i--) {
    try {
      const r = await fetch(url, { headers: API_HEADERS });
      const d = await r.json();
      if (d.errors && Object.keys(d.errors).length) throw new Error(JSON.stringify(d.errors));
      return d.response || [];
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals, htScores = {}) {
  if (!homeHistory) return null;

  let homeHits = 0, awayHits = 0, homeValid = 0, awayValid = 0;

  for (const match of homeHistory) {
    let actualValue = 0, isValid = false;

    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') {
        isValid = true;
        if (candidate.teamTarget === 'TOTAL') actualValue = (match.goals_for || 0) + (match.goals_against || 0);
        else if (candidate.teamTarget === 'HOME') actualValue = match.is_home ? (match.goals_for || 0) : (match.goals_against || 0);
        else actualValue = match.is_home ? (match.goals_against || 0) : (match.goals_for || 0);
      } else if (candidate.period === 'HT' || candidate.period === '2H') {
        const ht = htScores[match.fixture_id];
        if (ht) {
          isValid = true;
          const htHome = ht.ht_home ?? 0, htAway = ht.ht_away ?? 0;
          const teamHT = match.is_home ? htHome : htAway;
          const oppHT  = match.is_home ? htAway  : htHome;
          if (candidate.period === 'HT') {
            if (candidate.teamTarget === 'TOTAL') actualValue = htHome + htAway;
            else if (candidate.teamTarget === 'HOME') actualValue = teamHT;
            else actualValue = oppHT;
          } else {
            const team2H = (match.goals_for  || 0) - teamHT;
            const opp2H  = (match.goals_against || 0) - oppHT;
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
          if (tot?.corners_ht != null) { actualValue = tot.corners_ht; isValid = true; }
        } else {
          const ck = match.stats_1h?.find(s => s.type === 'Corner Kicks');
          if (ck) { actualValue = parseInt(ck.value) || 0; isValid = true; }
        }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot?.corners != null) { actualValue = tot.corners; isValid = true; }
        } else {
          if (match.corners != null) { actualValue = match.corners; isValid = true; }
        }
      }
    } else if (candidate.stat === 'CARTÕES') {
      if (candidate.period === 'HT') {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot?.cards_ht != null) { actualValue = tot.cards_ht; isValid = true; }
        } else {
          const yc = match.stats_1h?.find(s => s.type === 'Yellow Cards');
          const rc = match.stats_1h?.find(s => s.type === 'Red Cards');
          if (yc || rc) { actualValue = (parseInt(yc?.value)||0) + (parseInt(rc?.value)||0); isValid = true; }
        }
      } else {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot?.cards != null) { actualValue = tot.cards; isValid = true; }
        } else {
          const y = match.stats_ft?.find(s => s.type === 'Yellow Cards');
          const r = match.stats_ft?.find(s => s.type === 'Red Cards');
          if (y || r) { actualValue = (parseInt(y?.value)||0) + (parseInt(r?.value)||0); isValid = true; }
        }
      }
    } else if (candidate.stat === 'CHUTES_GOL') {
      if (candidate.teamTarget === 'TOTAL') {
        const tot = matchTotals[match.fixture_id];
        if (tot?.shots_on_goal_count >= 2) { actualValue = tot.shots_on_goal; isValid = true; }
      } else {
        if (match.shots_on_goal != null) { actualValue = match.shots_on_goal; isValid = true; }
      }
    } else if (candidate.stat === 'CHUTES_TOTAL') {
      if (candidate.teamTarget === 'TOTAL') {
        const tot = matchTotals[match.fixture_id];
        if (tot?.shots_total_count >= 2) { actualValue = tot.shots_total; isValid = true; }
      } else {
        if (match.shots_total != null) { actualValue = match.shots_total; isValid = true; }
      }
    } else if (candidate.stat === 'IMPEDIMENTOS') {
      if (candidate.teamTarget === 'TOTAL') {
        const tot = matchTotals[match.fixture_id];
        if (tot?.offsides != null) { actualValue = tot.offsides; isValid = true; }
      } else {
        if (match.offsides != null) { actualValue = match.offsides; isValid = true; }
        else {
          const s = match.stats_ft?.find(s => s.type === 'Offsides');
          if (s) { actualValue = parseInt(s.value) || 0; isValid = true; }
        }
      }
    } else if (candidate.stat === 'GOLS_SOFRIDOS') {
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
    } else if (candidate.stat === 'RESULTADO') {
      // type: 'H' = vitória casa, 'D' = empate, 'A' = vitória fora
      if (match.goals_for != null && match.goals_against != null) {
        isValid = true;
        const outcome = match.goals_for > match.goals_against ? 'H'
          : match.goals_for < match.goals_against ? 'A' : 'D';
        actualValue = (outcome === candidate.type) ? 1 : 0;
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
    if (homeValid < MIN_GAMES) return null;
    return { pct: (homeHits / homeValid) * 100, hits: homeHits, total: homeValid };
  }

  for (const match of (awayHistory || [])) {
    let actualValue = 0, isValid = false;

    if (candidate.stat === 'GOLS') {
      if (candidate.period === 'FT') {
        isValid = true;
        actualValue = (match.goals_for || 0) + (match.goals_against || 0);
      } else if (candidate.period === 'HT' || candidate.period === '2H') {
        const ht = htScores[match.fixture_id];
        if (ht) {
          isValid = true;
          const htHome = ht.ht_home ?? 0, htAway = ht.ht_away ?? 0;
          const teamHT = match.is_home ? htHome : htAway;
          const oppHT  = match.is_home ? htAway  : htHome;
          if (candidate.period === 'HT') actualValue = htHome + htAway;
          else actualValue = ((match.goals_for||0) - teamHT) + ((match.goals_against||0) - oppHT);
        }
      }
    } else if (candidate.stat === 'ESCANTEIOS') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'HT') { if (tot?.corners_ht != null) { actualValue = tot.corners_ht; isValid = true; } }
      else { if (tot?.corners != null) { actualValue = tot.corners; isValid = true; } }
    } else if (candidate.stat === 'CARTÕES') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'HT') { if (tot?.cards_ht != null) { actualValue = tot.cards_ht; isValid = true; } }
      else { if (tot?.cards != null) { actualValue = tot.cards; isValid = true; } }
    } else if (candidate.stat === 'IMPEDIMENTOS') {
      const tot = matchTotals[match.fixture_id];
      if (tot?.offsides != null) { actualValue = tot.offsides; isValid = true; }
    } else if (candidate.stat === 'CHUTES_GOL') {
      const tot = matchTotals[match.fixture_id];
      if (tot?.shots_on_goal_count >= 2) { actualValue = tot.shots_on_goal; isValid = true; }
    } else if (candidate.stat === 'CHUTES_TOTAL') {
      const tot = matchTotals[match.fixture_id];
      if (tot?.shots_total_count >= 2) { actualValue = tot.shots_total; isValid = true; }
    } else if (candidate.stat === 'RESULTADO') {
      if (match.goals_for != null && match.goals_against != null) {
        isValid = true;
        const outcome = match.goals_for > match.goals_against ? 'H'
          : match.goals_for < match.goals_against ? 'A' : 'D';
        actualValue = (outcome === candidate.type) ? 1 : 0;
      }
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

  const total = homeValid + awayValid;
  if (total < MIN_GAMES) return null;
  return { pct: ((homeHits + awayHits) / total) * 100, hits: homeHits + awayHits, total };
}

function parseOpportunitiesFallback(fixtureId, homeName, awayName, homeHistory, awayHistory, matchTotals, htScores = {}) {
  const opportunities = [];
  
  for (const f of FALLBACK_CANDIDATES) {
    let line = f.line;
    if (f.stat === 'RESULTADO' || f.stat === 'RESULTADO_HT' || f.stat === 'DUPLA_CHANCE') {
        if (f.line === 'Vitória Casa') line = `Vitória ${homeName}`;
        else if (f.line === 'Vitória Fora') line = `Vitória ${awayName}`;
        else if (f.line === 'Casa ou Empate') line = `${homeName} ou Empate`;
        else if (f.line === 'Fora ou Empate') line = `${awayName} ou Empate`;
    }

    const candidate = {
      fixture_id: fixtureId, betId: f.betId,
      market: f.market, stat: f.stat, period: f.period,
      teamTarget: f.teamTarget,
      team: f.teamTarget === 'HOME' ? homeName : f.teamTarget === 'AWAY' ? awayName : 'Total',
      type: f.type, threshold: f.threshold, line: line, odd: 0
    };

    let prob = null;
    if (f.teamTarget === 'TOTAL') {
      prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals, htScores);
    } else if (f.teamTarget === 'HOME') {
      prob = evaluateHistoricalFrequency(candidate, homeHistory, null, matchTotals, htScores);
    } else {
      prob = evaluateHistoricalFrequency(candidate, awayHistory, null, matchTotals, htScores);
    }

    if (prob && prob.pct >= MIN_PROB) {
      opportunities.push({
        ...candidate,
        probability: Math.round(prob.pct),
        histHits: prob.hits,
        histTotal: prob.total
      });
    }
  }
  return opportunities;
}

function parseOpportunitiesFromOdds(fixtureId, homeName, awayName, oddsResp, homeHistory, awayHistory, matchTotals, htScores = {}) {
  // Prioriza Bet365, mas faz fallback para outras casas se não encontrar
  const allBookmakers = (oddsResp || []).flatMap(r => r.bookmakers || []);
  const bet365 = allBookmakers.find(b => b.id === BOOKMAKER_ID);
  const fallbackBookmaker = !bet365 ? allBookmakers[0] : null;
  const bookmaker = bet365 || fallbackBookmaker;
  if (!bookmaker) return [];
  if (fallbackBookmaker) console.log(`    ⚠️ Bet365 indisponível, usando ${fallbackBookmaker.name || 'casa alternativa'} (id: ${fallbackBookmaker.id})`);

  const opportunities = [];

  // ── Mercado 1x2 (Resultado Final) ──
  const bet1 = (bookmaker.bets || []).find(b => b.id === 1);
  if (bet1) {
    const outcomes = [
      { value: 'Home', teamTarget: 'HOME', type: 'H', line: `Vitória ${homeName}`, team: homeName },
      { value: 'Draw', teamTarget: 'TOTAL', type: 'D', line: 'Empate', team: 'Empate' },
      { value: 'Away', teamTarget: 'AWAY',  type: 'A', line: `Vitória ${awayName}`,  team: awayName },
    ];
    for (const o of outcomes) {
      const v = (bet1.values || []).find(bv => String(bv.value) === o.value);
      if (!v) continue;
      const odd = parseFloat(v.odd);
      if (odd < MIN_ODD) continue;

      const candidate = {
        fixture_id: fixtureId, betId: 1,
        market: '1x2 Resultado Final', stat: 'RESULTADO', period: 'FT',
        teamTarget: o.teamTarget, team: o.team,
        type: o.type, threshold: 0, line: o.line, odd,
      };

      // HOME WIN: usa homeHistory; AWAY WIN: usa awayHistory; DRAW: usa ambos
      const h = o.teamTarget === 'HOME' ? homeHistory : o.teamTarget === 'AWAY' ? awayHistory : homeHistory;
      const a = o.teamTarget === 'TOTAL' ? awayHistory : null;
      const prob = evaluateHistoricalFrequency(candidate, h, a, matchTotals, htScores);

      if (prob && prob.pct >= MIN_PROB) {
        opportunities.push({ ...candidate, probability: Math.round(prob.pct), histHits: prob.hits, histTotal: prob.total });
      }
    }
  }

  for (const bet of (bookmaker.bets || [])) {
    const market = MARKETS[bet.id];
    if (!market) continue;

    const pairs = {};
    for (const v of (bet.values || [])) {
      const m = String(v.value).match(/^(Over|Under)\s+([\d.]+)$/i);
      if (!m) continue;
      const type = m[1].toUpperCase();
      const threshold = parseFloat(m[2]);
      if (!pairs[threshold]) pairs[threshold] = {};
      pairs[threshold][type] = parseFloat(v.odd);
    }

    for (const [threshStr, sides] of Object.entries(pairs)) {
      const threshold = parseFloat(threshStr);

      for (const [type, odd] of Object.entries(sides)) {
        if (odd < MIN_ODD) continue;

        const candidate = {
          fixture_id: fixtureId, betId: bet.id,
          market: market.label, stat: market.stat, period: market.period,
          teamTarget: market.teamTarget,
          team: market.teamTarget === 'HOME' ? homeName : market.teamTarget === 'AWAY' ? awayName : 'Total',
          type, threshold,
          line: `${type === 'OVER' ? 'Mais de' : 'Menos de'} ${threshold}`,
          odd,
        };

        let prob = null;
        if (market.teamTarget === 'TOTAL') {
          prob = evaluateHistoricalFrequency(candidate, homeHistory, awayHistory, matchTotals, htScores);
        } else if (market.teamTarget === 'HOME') {
          prob = evaluateHistoricalFrequency(candidate, homeHistory, null, matchTotals, htScores);
        } else {
          prob = evaluateHistoricalFrequency(candidate, awayHistory, null, matchTotals, htScores);
        }

        if (prob && prob.pct >= MIN_PROB) {
          opportunities.push({
            ...candidate,
            probability: Math.round(prob.pct),
            histHits:  prob.hits,
            histTotal: prob.total,
          });
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
    const _bet = (bookmaker.bets || []).find(b => b.id === _m.betId);
    if (!_bet) continue;
    for (const _v of (_bet.values || [])) {
      if (!['Yes', 'No'].includes(_v.value)) continue;
      const _odd = parseFloat(_v.odd);
      if (_odd < MIN_ODD) continue;
      const _type = _v.value.toUpperCase();
      let finalStat = _m.stat;
      let finalLine = _v.value === 'Yes' ? 'Sim' : 'Não';
      if (_m.stat === 'CLEAN_SHEET') {
        finalStat = 'GOLS_SOFRIDOS';
        finalLine = _v.value === 'No' ? 'Mais de 0.5 Gols Sofridos' : 'Menos de 0.5 Gols Sofridos';
      }
      const _c = {
        fixture_id: fixtureId, betId: _m.betId,
        market: _m.label, stat: finalStat, period: _m.period, teamTarget: _m.teamTarget,
        team: _m.teamTarget === 'HOME' ? homeName : _m.teamTarget === 'AWAY' ? awayName : 'Total',
        type: _type, threshold: 0, line: finalLine, odd: _odd,
      };
      const _hist = _m.teamTarget === 'HOME' ? homeHistory : _m.teamTarget === 'AWAY' ? awayHistory : null;
      const _prob = evaluateHistoricalFrequency(_c, _hist || homeHistory, _m.teamTarget === 'TOTAL' ? awayHistory : null, matchTotals, htScores);
      if (_prob && _prob.pct >= MIN_PROB) {
        opportunities.push({ ..._c, probability: Math.round(_prob.pct), histHits: _prob.hits, histTotal: _prob.total });
      }
    }
  }

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
    const _bet = (bookmaker.bets || []).find(b => b.id === _rm.betId);
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
      if (_prob && _prob.pct >= MIN_PROB) {
        opportunities.push({ ..._c, probability: Math.round(_prob.pct), histHits: _prob.hits, histTotal: _prob.total });
      }
    }
  }

  // GOLS_SOFRIDOS: mesmos mercados de gols, avaliados pelo goals_against do time que sofre
  const sofridosMap = [
    { betId: 17,  label: 'Gols Sofridos (Casa)',    period: 'FT',  teamTarget: 'HOME', team: homeName, hist: homeHistory },
    { betId: 16,  label: 'Gols Sofridos (Fora)',    period: 'FT',  teamTarget: 'AWAY', team: awayName, hist: awayHistory },
    { betId: 106, label: 'Gols Sofridos 1T (Casa)', period: 'HT',  teamTarget: 'HOME', team: homeName, hist: homeHistory },
    { betId: 105, label: 'Gols Sofridos 1T (Fora)', period: 'HT',  teamTarget: 'AWAY', team: awayName, hist: awayHistory },
    { betId: 108, label: 'Gols Sofridos 2T (Casa)', period: '2H',  teamTarget: 'HOME', team: homeName, hist: homeHistory },
    { betId: 107, label: 'Gols Sofridos 2T (Fora)', period: '2H',  teamTarget: 'AWAY', team: awayName, hist: awayHistory },
  ];
  for (const m of sofridosMap) {
    const bet = (bookmaker.bets || []).find(b => b.id === m.betId);
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
        if (prob && prob.pct >= MIN_PROB) {
          opportunities.push({ ...candidate, probability: Math.round(prob.pct), histHits: prob.hits, histTotal: prob.total });
        }
      }
    }
  }

  return opportunities;
}

async function generateOpportunities() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  let targetDate = process.argv[2];
  if (!targetDate || targetDate === '--force') targetDate = brt.toISOString().split('T')[0];

  console.log(`\n=== Oportunidades do Dia — ${targetDate} (prob ≥ ${MIN_PROB}%) ===\n`);

  if (!process.argv.includes('--force')) {
    const { data: existing } = await supabase.from('odd_tickets')
      .select('date').eq('date', targetDate).eq('mode', 'opp').maybeSingle();
    if (existing) {
      console.log(`Oportunidades para ${targetDate} já existem. Use --force para regeração.`);
      return;
    }
  }

  const { data: leagues } = await supabase.from('leagues').select('id, api_id').eq('is_active', true);
  const activeLeagueApiIds = new Set((leagues || []).map(l => l.api_id));

  // Janela BRT (UTC-3): dia D começa às 03:00 UTC e termina às 02:59 UTC do dia D+1.
  // Isso garante que jogos das 21h–23h59 BRT (00h–02h59 UTC do dia seguinte) sejam incluídos.
  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextDate = new Date(`${targetDate}T03:00:00Z`);
  nextDate.setDate(nextDate.getDate() + 1);
  const endDateStr = nextDate.toISOString().replace('T', ' ').substring(0, 19); // D+1 03:00 UTC = D+1 00:00 BRT

  let query = supabase
    .from('fixtures')
    .select('id, api_id, date, status, season, league_id, home_team:teams!fixtures_home_team_id_fkey(api_id, name, logo_url), away_team:teams!fixtures_away_team_id_fkey(api_id, name, logo_url), league:leagues!fixtures_league_id_fkey(api_id, name, logo_url)')
    .gte('date', `${targetDate} 03:00:00`)
    .lte('date', endDateStr);

  // Só filtra por NS/TBD quando gera para hoje SEM --force (evita incluir jogos já em andamento)
  // Com --force ou para outras datas, aceita qualquer status (mesma lógica do generateOdd2/generateOdd3)
  const isForce = process.argv.includes('--force');
  if (targetDate === brtNow && !isForce) {
    query = query.in('status', ['NS', 'TBD']);
  }

  const { data: fixtures } = await query;

  const activeFix = (fixtures || []).filter(f => activeLeagueApiIds.has(f.league?.api_id));
  console.log(`Fixtures ativos: ${activeFix.length}`);

  const allOpportunities = [];
  let analyzed = 0, skipped = 0;

  for (const f of activeFix) {
    const homeName = f.home_team?.name || 'Casa';
    const awayName = f.away_team?.name || 'Fora';

    // Bloqueio manual da Champions League (api_id 2)
    if (f.league?.api_id === 2) {
      console.log(`  [${analyzed + skipped + 1}/${activeFix.length}] ${homeName} x ${awayName} ... Ignorado (Manual: Champions League - Final)`);
      skipped++;
      continue;
    }

    process.stdout.write(`  [${analyzed + skipped + 1}/${activeFix.length}] ${homeName} x ${awayName} ... `);

    try {
      // Usa league_id do fixture (db_id) para filtrar teams_history corretamente
      const leagueFilter = f.league_id;

      const { data: homeHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.home_team.api_id).eq('season', f.season)
        .eq('league_id', leagueFilter).eq('is_home', true);
      const { data: awayHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', f.away_team.api_id).eq('season', f.season)
        .eq('league_id', leagueFilter).eq('is_home', false);

      if ((homeHistory?.length || 0) < MIN_GAMES || (awayHistory?.length || 0) < MIN_GAMES) {
        console.log(`Ignorado (${homeHistory?.length || 0}C/${awayHistory?.length || 0}F jogos)`);
        skipped++;
        continue;
      }

      // matchTotals
      const matchTotals = {};
      const histFixIds = [...new Set([...(homeHistory||[]), ...(awayHistory||[])].map(h => h.fixture_id))];
      const { data: opData } = await supabase.from('teams_history')
        .select('fixture_id, corners, shots_on_goal, shots_total, offsides, goalkeeper_saves, stats_ft, stats_1h')
        .in('fixture_id', histFixIds);
      for (const row of (opData || [])) {
        if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, corners_ht: 0, cards: 0, cards_ht: 0, shots_on_goal: 0, shots_on_goal_count: 0, shots_total: 0, shots_total_count: 0, offsides: 0, goalkeeper_saves: 0 };
        const t = matchTotals[row.fixture_id];
        t.corners += (row.corners || 0);
        const ck_ht = row.stats_1h?.find(s => s.type === 'Corner Kicks');
        t.corners_ht += parseInt(ck_ht?.value || 0);
        const y   = parseInt(row.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0);
        const r   = parseInt(row.stats_ft?.find(s => s.type === 'Red Cards')?.value   || 0);
        const y1h = parseInt(row.stats_1h?.find(s => s.type === 'Yellow Cards')?.value || 0);
        const r1h = parseInt(row.stats_1h?.find(s => s.type === 'Red Cards')?.value   || 0);
        t.cards    += (y + r);
        t.cards_ht += (y1h + r1h);
        if (row.shots_on_goal    != null) { t.shots_on_goal    += row.shots_on_goal;    t.shots_on_goal_count++; }
        if (row.shots_total      != null) { t.shots_total      += row.shots_total;      t.shots_total_count++;   }
        if (row.offsides         != null) t.offsides         += row.offsides;
        if (row.goalkeeper_saves != null) t.goalkeeper_saves += row.goalkeeper_saves;
      }

      // HT scores
      const htScores = {};
      const { data: fixtureRows } = await supabase.from('fixtures')
        .select('api_id, ht_home_score, ht_away_score').in('api_id', histFixIds);
      for (const fr of (fixtureRows || [])) {
        if (fr.ht_home_score != null) htScores[fr.api_id] = { ht_home: fr.ht_home_score, ht_away: fr.ht_away_score };
      }

      // Odds
      const oddsResp = await fetchApi(`https://v3.football.api-sports.io/odds?fixture=${f.api_id}`);
      await delay(300);

      let opps = parseOpportunitiesFromOdds(f.api_id, homeName, awayName, oddsResp, homeHistory, awayHistory, matchTotals, htScores);
      
      if (opps.length === 0) {
        opps = parseOpportunitiesFallback(f.api_id, homeName, awayName, homeHistory, awayHistory, matchTotals, htScores);
        if (opps.length > 0) console.log(`[Usando Fallback] `);
      }

      console.log(`${opps.length} oportunidade(s)`);

      allOpportunities.push(...opps.map(o => ({
        ...o,
        fixture_db_id: f.id,        // DB primary key — usado para navegação no app
        home: homeName,
        away: awayName,
        homeLogo: f.home_team?.logo_url || '',
        awayLogo: f.away_team?.logo_url || '',
        date_time: f.date,
        leagueName: f.league?.name || '',
        leagueLogo: f.league?.logo_url || '',
      })));

      analyzed++;
    } catch (e) {
      console.log(`ERRO: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\nTotal: ${allOpportunities.length} oportunidades em ${analyzed} jogos analisados (${skipped} ignorados)`);

  if (allOpportunities.length === 0) {
    console.log('Nenhuma oportunidade ≥ 90% encontrada.');
    
    // Se não analisou nenhum jogo (todos foram ignorados por erro na API ou falta de dados),
    // não apaga o registro antigo para evitar perder dados gerados anteriormente.
    if (analyzed === 0 && skipped > 0) {
      console.log('Nenhum jogo foi analisado com sucesso. O registro anterior será mantido.');
      return;
    }

    // Limpa registro antigo se existir (evita dados obsoletos na UI)
    const { error } = await supabase.from('odd_tickets')
      .delete().eq('date', targetDate).eq('mode', 'opp');
    if (error) console.error('Erro ao limpar registro antigo:', error.message);
    else console.log(`Registro antigo para ${targetDate} removido (se existia).`);
    return;
  }

  // Dedup: mesma chave fixture+stat+period+teamTarget+type+threshold
  const dedupSeen = new Set();
  const deduped = allOpportunities.filter(o => {
    const key = `${o.fixture_id}|${o.stat}|${o.period}|${o.teamTarget}|${o.type}|${o.threshold}`;
    if (dedupSeen.has(key)) return false;
    dedupSeen.add(key);
    return true;
  });
  if (deduped.length < allOpportunities.length)
    console.log(`  (${allOpportunities.length - deduped.length} duplicidade(s) removida(s))`);

  // Ordena por probabilidade desc, depois odd desc
  deduped.sort((a, b) => b.probability - a.probability || b.odd - a.odd);

  // Salva no banco
  const { error } = await supabase.from('odd_tickets').upsert({
    date: targetDate,
    mode: 'opp',
    total_odd: 0,
    matches_count: [...new Set(allOpportunities.map(o => o.fixture_id))].length,
    status: 'PENDING',
    ticket_data: {
      opportunities: deduped,
      generated_at: new Date().toISOString(),
    },
  }, { onConflict: 'date,mode' });

  if (error) console.error('Erro ao salvar:', error.message);
  else console.log(`\nOportunidades salvas para ${targetDate} (${deduped.length} picks, ${[...new Set(deduped.map(o => o.fixture_id))].length} jogos)`);

  // Preview top 10
  console.log('\n=== TOP OPORTUNIDADES ===');
  for (const o of deduped.slice(0, 15)) {
    console.log(`  [${o.probability}%] ${o.home} x ${o.away} — ${o.market} ${o.line} @ ${o.odd}  (${o.histHits}/${o.histTotal})`);
  }
}

generateOpportunities().catch(console.error);
