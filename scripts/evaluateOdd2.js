/**
 * Avaliação de bilhetes — Usa dados do banco (fixtures + teams_history) como fonte primária.
 * Suporta todos os stats: GOLS, GOLS_SOFRIDOS, ESCANTEIOS, CARTÕES, CHUTES_GOL, CHUTES_TOTAL,
 * IMPEDIMENTOS, RESULTADO, AMBOS_MARCAM, CLEAN_SHEET, DUPLA_CHANCE, RESULTADO_HT, RESULTADO_2H
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FT_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

/**
 * Avalia um pick individual contra os dados reais do banco
 * Retorna { result: 'WON'|'LOST'|null, actualValue: number|string|null }
 */
function evaluatePick(pick, fixture, homeHist, awayHist) {
  let teamTarget = pick.teamTarget;
  const period = pick.period || 'FT';
  let type = pick.type;
  const threshold = pick.threshold !== undefined
    ? pick.threshold
    : parseFloat((pick.line || '').split(' ').pop()) || 0;

  // Fallback para type ausente
  if (!type && pick.line) {
    if (pick.line.includes('Menos')) type = 'UNDER';
    else if (pick.line.includes('Mais')) type = 'OVER';
  }

  let actualValue = null;

  // ─── GOLS ───
  if (pick.stat === 'GOLS' || pick.stat === 'GOLS MARCADOS') {
    const htHome = fixture.ht_home_score ?? 0;
    const htAway = fixture.ht_away_score ?? 0;
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;

    if (period === 'FT') {
      if (teamTarget === 'TOTAL') actualValue = ftHome + ftAway;
      else if (teamTarget === 'HOME') actualValue = ftHome;
      else actualValue = ftAway;
    } else if (period === 'HT') {
      if (teamTarget === 'TOTAL') actualValue = htHome + htAway;
      else if (teamTarget === 'HOME') actualValue = htHome;
      else actualValue = htAway;
    } else if (period === '2H') {
      if (teamTarget === 'TOTAL') actualValue = (ftHome + ftAway) - (htHome + htAway);
      else if (teamTarget === 'HOME') actualValue = ftHome - htHome;
      else actualValue = ftAway - htAway;
    }
  }

  // ─── GOLS_SOFRIDOS ───
  // "Gols sofridos pelo time X" = gols marcados pelo adversário
  // HOME sofre = away_score, AWAY sofre = home_score
  // Caso especial: picks de Clean Sheet convertidos têm type=YES/NO
  //   NO  (Clean Sheet = Não) → sofreu gols → equivalente a OVER 0.5
  //   YES (Clean Sheet = Sim) → não sofreu  → equivalente a UNDER 0.5
  else if (pick.stat === 'GOLS_SOFRIDOS') {
    const htHome = fixture.ht_home_score ?? 0;
    const htAway = fixture.ht_away_score ?? 0;
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;

    if (period === 'FT') {
      if (teamTarget === 'HOME') actualValue = ftAway;
      else if (teamTarget === 'AWAY') actualValue = ftHome;
    } else if (period === 'HT') {
      if (teamTarget === 'HOME') actualValue = htAway;
      else if (teamTarget === 'AWAY') actualValue = htHome;
    } else if (period === '2H') {
      if (teamTarget === 'HOME') actualValue = ftAway - htAway;
      else if (teamTarget === 'AWAY') actualValue = ftHome - htHome;
    }

    // Conversão Clean Sheet: YES/NO → UNDER/OVER 0.5
    if (actualValue !== null && (type === 'NO' || type === 'YES')) {
      const won = type === 'NO' ? actualValue > 0 : actualValue === 0;
      return { result: won ? 'WON' : 'LOST', actualValue };
    }
  }

  // ─── ESCANTEIOS ───
  else if (pick.stat === 'ESCANTEIOS') {
    if (teamTarget === 'TOTAL') {
      const hc = homeHist?.corners;
      const ac = awayHist?.corners;
      if (hc != null && ac != null) actualValue = hc + ac;
    } else if (teamTarget === 'HOME') {
      actualValue = homeHist?.corners ?? null;
    } else {
      actualValue = awayHist?.corners ?? null;
    }
  }

  // ─── CARTÕES AMARELOS ───
  else if (pick.stat === 'CARTÕES_AMARELOS') {
    const getYellowCards = (hist) => {
      if (!hist) return null;
      if (period === 'HT' && hist.stats_1h) {
        return parseInt((hist.stats_1h.find(s => s.type === 'Yellow Cards'))?.value || 0);
      }
      if (hist.stats_ft) {
        return parseInt((hist.stats_ft.find(s => s.type === 'Yellow Cards'))?.value || 0);
      }
      return hist.yellow_cards ?? null;
    };
    if (teamTarget === 'TOTAL') {
      const hc = getYellowCards(homeHist);
      const ac = getYellowCards(awayHist);
      if (hc != null && ac != null) actualValue = hc + ac;
    } else if (teamTarget === 'HOME') {
      actualValue = getYellowCards(homeHist);
    } else {
      actualValue = getYellowCards(awayHist);
    }
  }

  // ─── FALTAS ───
  else if (pick.stat === 'FALTAS') {
    const getFouls = (hist) => {
      if (!hist || !hist.stats_ft) return null;
      return parseInt((hist.stats_ft.find(s => s.type === 'Fouls'))?.value || 0);
    };
    if (teamTarget === 'TOTAL') {
      const h = getFouls(homeHist);
      const a = getFouls(awayHist);
      if (h != null && a != null) actualValue = h + a;
    } else if (teamTarget === 'HOME') {
      actualValue = getFouls(homeHist);
    } else {
      actualValue = getFouls(awayHist);
    }
  }

  // ─── DESARMES ───
  else if (pick.stat === 'DESARMES') {
    const getTackles = (hist) => {
      if (!hist || !hist.stats_ft) return null;
      return parseInt((hist.stats_ft.find(s => s.type === 'Total tackles' || s.type === 'Tackles'))?.value || 0);
    };
    if (teamTarget === 'TOTAL') {
      const h = getTackles(homeHist);
      const a = getTackles(awayHist);
      if (h != null && a != null) actualValue = h + a;
    } else if (teamTarget === 'HOME') {
      actualValue = getTackles(homeHist);
    } else {
      actualValue = getTackles(awayHist);
    }
  }

  // ─── CARTÕES ───
  else if (pick.stat === 'CARTÕES' || pick.stat === 'CARTÃO AMARELO') {
    const getCards = (hist) => {
      if (!hist) return null;
      if (hist.stats_ft) {
        const y = parseInt((hist.stats_ft.find(s => s.type === 'Yellow Cards'))?.value || 0);
        const r = parseInt((hist.stats_ft.find(s => s.type === 'Red Cards'))?.value || 0);
        return y + r;
      }
      return hist.yellow_cards ?? null;
    };

    if (teamTarget === 'TOTAL') {
      const hc = getCards(homeHist);
      const ac = getCards(awayHist);
      if (hc != null && ac != null) actualValue = hc + ac;
    } else if (teamTarget === 'HOME') {
      actualValue = getCards(homeHist);
    } else {
      actualValue = getCards(awayHist);
    }
  }

  // ─── CHUTES AO GOL ───
  else if (pick.stat === 'CHUTES_GOL' || pick.stat === 'CHUTES NO GOL') {
    if (teamTarget === 'TOTAL') {
      const h = homeHist?.shots_on_goal;
      const a = awayHist?.shots_on_goal;
      if (h != null && a != null) actualValue = h + a;
    } else if (teamTarget === 'HOME') {
      actualValue = homeHist?.shots_on_goal ?? null;
    } else {
      actualValue = awayHist?.shots_on_goal ?? null;
    }
  }

  // ─── CHUTES TOTAIS ───
  else if (pick.stat === 'CHUTES_TOTAL' || pick.stat === 'CHUTES') {
    if (teamTarget === 'TOTAL') {
      const h = homeHist?.shots_total;
      const a = awayHist?.shots_total;
      if (h != null && a != null) actualValue = h + a;
    } else if (teamTarget === 'HOME') {
      actualValue = homeHist?.shots_total ?? null;
    } else {
      actualValue = awayHist?.shots_total ?? null;
    }
  }

  // ─── IMPEDIMENTOS ───
  else if (pick.stat === 'IMPEDIMENTOS') {
    if (teamTarget === 'TOTAL') {
      const h = homeHist?.offsides;
      const a = awayHist?.offsides;
      if (h != null && a != null) actualValue = h + a;
    } else if (teamTarget === 'HOME') {
      actualValue = homeHist?.offsides ?? null;
    } else {
      actualValue = awayHist?.offsides ?? null;
    }
  }

  // ─── DEFESAS ───
  else if (pick.stat === 'DEFESAS') {
    if (teamTarget === 'TOTAL') {
      const h = homeHist?.goalkeeper_saves;
      const a = awayHist?.goalkeeper_saves;
      if (h != null && a != null) actualValue = h + a;
    } else if (teamTarget === 'HOME') {
      actualValue = homeHist?.goalkeeper_saves ?? null;
    } else {
      actualValue = awayHist?.goalkeeper_saves ?? null;
    }
  }

  // ─── RESULTADO (1x2) ───
  else if (pick.stat === 'RESULTADO') {
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;
    const outcome = ftHome > ftAway ? 'H' : ftHome < ftAway ? 'A' : 'D';
    return { result: outcome === type ? 'WON' : 'LOST', actualValue: `${ftHome}-${ftAway}` };
  }

  // ─── AMBOS_MARCAM ───
  else if (pick.stat === 'AMBOS_MARCAM') {
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;
    const htHome = fixture.ht_home_score ?? 0;
    const htAway = fixture.ht_away_score ?? 0;

    let hit = false;
    if (period === 'FT') hit = ftHome > 0 && ftAway > 0;
    else if (period === 'HT') hit = htHome > 0 && htAway > 0;
    else if (period === '2H') hit = (ftHome - htHome) > 0 && (ftAway - htAway) > 0;

    return { result: (type === 'YES' ? hit : !hit) ? 'WON' : 'LOST', actualValue: hit ? 1 : 0 };
  }

  // ─── CLEAN_SHEET ───
  else if (pick.stat === 'CLEAN_SHEET') {
    const conceded = teamTarget === 'HOME' ? (fixture.away_score ?? 0) : (fixture.home_score ?? 0);
    const hit = conceded === 0;
    return { result: (type === 'YES' ? hit : !hit) ? 'WON' : 'LOST', actualValue: conceded };
  }

  // ─── DUPLA_CHANCE ───
  else if (pick.stat === 'DUPLA_CHANCE') {
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;
    const outcome = ftHome > ftAway ? 'H' : ftHome < ftAway ? 'A' : 'D';
    let hit = false;
    if (type === 'HD') hit = outcome !== 'A';
    else if (type === 'HA') hit = outcome !== 'D';
    else if (type === 'DA') hit = outcome !== 'H';
    return { result: hit ? 'WON' : 'LOST', actualValue: `${ftHome}-${ftAway}` };
  }

  // ─── RESULTADO_HT ───
  else if (pick.stat === 'RESULTADO_HT') {
    const htHome = fixture.ht_home_score;
    const htAway = fixture.ht_away_score;
    if (htHome == null) return { result: null, actualValue: null };
    const outcome = htHome > htAway ? 'H' : htHome < htAway ? 'A' : 'D';
    return { result: outcome === type ? 'WON' : 'LOST', actualValue: `${htHome}-${htAway}` };
  }

  // ─── RESULTADO_2H ───
  else if (pick.stat === 'RESULTADO_2H') {
    const htHome = fixture.ht_home_score;
    if (htHome == null) return { result: null, actualValue: null };
    const h2H = (fixture.home_score ?? 0) - htHome;
    const a2H = (fixture.away_score ?? 0) - (fixture.ht_away_score ?? 0);
    const outcome = h2H > a2H ? 'H' : h2H < a2H ? 'A' : 'D';
    return { result: outcome === type ? 'WON' : 'LOST', actualValue: `${h2H}-${a2H}` };
  }

  if (actualValue === null) return { result: null, actualValue: null };

  // Avaliar OVER/UNDER/YES/NO
  let result = null;
  if (type === 'OVER') result = actualValue > threshold ? 'WON' : 'LOST';
  else if (type === 'UNDER') result = actualValue < threshold ? 'WON' : 'LOST';
  else if (type === 'YES') result = actualValue > 0 ? 'WON' : 'LOST';
  else if (type === 'NO') result = actualValue === 0 ? 'WON' : 'LOST';

  return { result, actualValue };
}

async function evaluateTicket() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  let targetDate;
  if (args[0]) {
    targetDate = args[0];
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  console.log(`\n=== Avaliando Tickets: ${targetDate} ===`);

  const { data: tickets, error } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('date', targetDate);

  if (error || !tickets || tickets.length === 0) {
    console.log("Nenhum ticket encontrado para avaliar nesta data.");
    return;
  }

  for (const ticket of tickets) {
    console.log(`\n--- Avaliando Ticket Modo: ${ticket.mode} (Odd ${ticket.total_odd}) ---`);

    const entries = ticket.ticket_data.entries || [];
    if (!entries.length) {
      console.log('  Bilhete sem entries.');
      continue;
    }

    // Coleta todos os fixture_ids do bilhete
    const fixtureIds = [...new Set(entries.map(e => e.fixture_id))];

    // Busca fixtures do banco (fonte de verdade para placares)
    const { data: fixtures } = await supabase
      .from('fixtures')
      .select('api_id, home_score, away_score, ht_home_score, ht_away_score, status')
      .in('api_id', fixtureIds);

    const fixMap = {};
    for (const f of (fixtures || [])) fixMap[f.api_id] = f;

    // Busca teams_history para estatísticas (escanteios, cartões, chutes, etc.)
    const { data: histRows } = await supabase
      .from('teams_history')
      .select('fixture_id, team_id, is_home, corners, shots_on_goal, shots_total, yellow_cards, offsides, goalkeeper_saves, stats_ft, stats_1h')
      .in('fixture_id', fixtureIds);

    const histMap = {};
    for (const r of (histRows || [])) {
      const key = `${r.fixture_id}-${r.is_home ? 'HOME' : 'AWAY'}`;
      histMap[key] = r;
    }

    let allGreen = true;
    let hasIncomplete = false;

    for (const entry of entries) {
      console.log(`\nAvaliando ${entry.home} x ${entry.away} (${entry.fixture_id})`);

      const fix = fixMap[entry.fixture_id];
      if (!fix || !FT_STATUSES.includes(fix.status)) {
        console.log(`  Partida não finalizada (status: ${fix?.status || 'N/A'})`);
        hasIncomplete = true;
        entry.matchResult = 'PENDING';
        entry.result = 'PENDING';
        continue;
      }

      const homeHist = histMap[`${entry.fixture_id}-HOME`];
      const awayHist = histMap[`${entry.fixture_id}-AWAY`];

      let matchGreen = true;
      for (const pick of entry.picks) {
        const { result, actualValue } = evaluatePick(pick, fix, homeHist, awayHist);

        if (result === null) {
          console.log(`  ⚠️ ${pick.stat} ${pick.line} — SEM DADOS`);
          hasIncomplete = true;
          continue;
        }

        pick.result = result;
        pick.actualValue = actualValue;

        const symbol = result === 'WON' ? '✅' : '❌';
        console.log(`  ${symbol} [${pick.period}] ${pick.stat} ${pick.teamTarget} ${pick.line} → Real: ${actualValue} = ${result}`);

        if (result !== 'WON') { matchGreen = false; allGreen = false; }
      }

      entry.matchResult = matchGreen ? 'WON' : 'LOST';
      entry.result = entry.matchResult;
    }

    const finalStatus = hasIncomplete ? 'PENDING' : allGreen ? 'WON' : 'LOST';

    await supabase.from('odd_tickets').update({
      status: finalStatus,
      ticket_data: ticket.ticket_data
    }).eq('date', targetDate).eq('mode', ticket.mode);

    console.log(`\nTicket ${ticket.mode} Avaliado como: ${finalStatus}`);
  }
}

evaluateTicket().catch(console.error);
