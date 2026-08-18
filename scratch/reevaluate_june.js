/**
 * Re-avaliação completa dos bilhetes de junho/2026
 * Corrige bugs do evaluateOdd2.js:
 *  1. GOLS_SOFRIDOS não era tratado (retornava 0)
 *  2. ESCANTEIOS/CARTÕES com actualValue=0 quando API retornava dados em formato diferente
 *  3. Usa dados do banco (teams_history) como fonte primária — mais confiável que a API em tempo real
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

const FT_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

/**
 * Avalia um pick individual contra os dados reais
 * Retorna { result: 'WON'|'LOST'|null, actualValue: number|null }
 */
function evaluatePick(pick, fixture, homeHist, awayHist) {
  const teamTarget = pick.teamTarget;
  const period = pick.period || 'FT';
  const type = pick.type;
  const threshold = pick.threshold !== undefined 
    ? pick.threshold 
    : parseFloat((pick.line || '').split(' ').pop()) || 0;

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
  else if (pick.stat === 'GOLS_SOFRIDOS') {
    const htHome = fixture.ht_home_score ?? 0;
    const htAway = fixture.ht_away_score ?? 0;
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;

    if (period === 'FT') {
      if (teamTarget === 'HOME') actualValue = ftAway;       // gols sofridos pelo mandante
      else if (teamTarget === 'AWAY') actualValue = ftHome;  // gols sofridos pelo visitante
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

  // ─── CARTÕES ───
  else if (pick.stat === 'CARTÕES') {
    const getCards = (hist) => {
      if (!hist) return null;
      // Try stats_ft first (Yellow + Red)
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
  else if (pick.stat === 'CHUTES_GOL') {
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
  else if (pick.stat === 'CHUTES_TOTAL') {
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

  // ─── RESULTADO ───
  else if (pick.stat === 'RESULTADO') {
    const ftHome = fixture.home_score ?? 0;
    const ftAway = fixture.away_score ?? 0;
    const outcome = ftHome > ftAway ? 'H' : ftHome < ftAway ? 'A' : 'D';
    const result = outcome === type ? 'WON' : 'LOST';
    return { result, actualValue: `${ftHome}-${ftAway}` };
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
    
    const result = (type === 'YES' ? hit : !hit) ? 'WON' : 'LOST';
    return { result, actualValue: hit ? 'Sim' : 'Não' };
  }

  // ─── CLEAN_SHEET ───
  else if (pick.stat === 'CLEAN_SHEET') {
    const conceded = teamTarget === 'HOME' ? (fixture.away_score ?? 0) : (fixture.home_score ?? 0);
    const hit = conceded === 0;
    const result = (type === 'YES' ? hit : !hit) ? 'WON' : 'LOST';
    return { result, actualValue: conceded };
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
    const result = hit ? 'WON' : 'LOST';
    return { result, actualValue: `${ftHome}-${ftAway}` };
  }

  // ─── RESULTADO_HT ───
  else if (pick.stat === 'RESULTADO_HT') {
    const htHome = fixture.ht_home_score;
    const htAway = fixture.ht_away_score;
    if (htHome == null) return { result: null, actualValue: null };
    const outcome = htHome > htAway ? 'H' : htHome < htAway ? 'A' : 'D';
    const result = outcome === type ? 'WON' : 'LOST';
    return { result, actualValue: `${htHome}-${htAway}` };
  }

  // ─── RESULTADO_2H ───
  else if (pick.stat === 'RESULTADO_2H') {
    const htHome = fixture.ht_home_score;
    if (htHome == null) return { result: null, actualValue: null };
    const h2H = (fixture.home_score ?? 0) - htHome;
    const a2H = (fixture.away_score ?? 0) - (fixture.ht_away_score ?? 0);
    const outcome = h2H > a2H ? 'H' : h2H < a2H ? 'A' : 'D';
    const result = outcome === type ? 'WON' : 'LOST';
    return { result, actualValue: `${h2H}-${a2H}` };
  }

  if (actualValue === null) return { result: null, actualValue: null };

  // Evaluate OVER/UNDER/YES/NO
  let result = null;
  if (type === 'OVER') result = actualValue > threshold ? 'WON' : 'LOST';
  else if (type === 'UNDER') result = actualValue < threshold ? 'WON' : 'LOST';
  else if (type === 'YES') result = actualValue > 0 ? 'WON' : 'LOST';
  else if (type === 'NO') result = actualValue === 0 ? 'WON' : 'LOST';

  return { result, actualValue };
}

async function reevaluateJune() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const startDate = args[0] || '2026-06-01';
  const endDate = args[1] || '2026-06-30';
  const dryRun = !process.argv.includes('--apply');

  console.log(`\n=== Re-avaliação de bilhetes ${startDate} a ${endDate} ===`);
  if (dryRun) console.log('📋 MODO SIMULAÇÃO — use --apply para salvar as correções\n');
  else console.log('💾 MODO APLICAÇÃO — alterações serão salvas no banco\n');

  const { data: tickets } = await supabase
    .from('odd_tickets')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .in('mode', ['2.0', '3.0'])
    .order('date');

  let totalFixed = 0;
  let totalChecked = 0;

  for (const ticket of tickets) {
    const entries = ticket.ticket_data?.entries || [];
    if (!entries.length) continue;

    // Collect all fixture_ids
    const fixtureIds = [...new Set(entries.map(e => e.fixture_id))];

    // Fetch fixtures from DB
    const { data: fixtures } = await supabase
      .from('fixtures')
      .select('api_id, home_score, away_score, ht_home_score, ht_away_score, status')
      .in('api_id', fixtureIds);

    const fixMap = {};
    for (const f of (fixtures || [])) fixMap[f.api_id] = f;

    // Fetch teams_history for all fixtures
    const { data: histRows } = await supabase
      .from('teams_history')
      .select('fixture_id, team_id, is_home, corners, shots_on_goal, shots_total, yellow_cards, offsides, goalkeeper_saves, stats_ft, stats_1h')
      .in('fixture_id', fixtureIds);

    const histMap = {};
    for (const r of (histRows || [])) {
      const key = `${r.fixture_id}-${r.is_home ? 'HOME' : 'AWAY'}`;
      histMap[key] = r;
    }

    let ticketChanged = false;
    let allGreen = true;
    let hasIncomplete = false;

    console.log(`\n─── ${ticket.date} | ${ticket.mode} | atual: ${ticket.status} ───`);

    for (const entry of entries) {
      const fix = fixMap[entry.fixture_id];
      if (!fix || !FT_STATUSES.includes(fix.status)) {
        console.log(`  ${entry.home} x ${entry.away} — NÃO FINALIZADO`);
        hasIncomplete = true;
        continue;
      }

      const homeHist = histMap[`${entry.fixture_id}-HOME`];
      const awayHist = histMap[`${entry.fixture_id}-AWAY`];

      let matchGreen = true;
      for (const pick of entry.picks) {
        totalChecked++;
        const { result, actualValue } = evaluatePick(pick, fix, homeHist, awayHist);

        const oldResult = pick.result;
        const oldActual = pick.actualValue;
        
        if (result === null) {
          console.log(`  ⚠️  ${entry.home} x ${entry.away} | ${pick.stat} ${pick.line} — SEM DADOS`);
          hasIncomplete = true;
          continue;
        }

        if (result !== oldResult || actualValue !== oldActual) {
          const emoji = oldResult !== result ? '🔄' : '📊';
          console.log(`  ${emoji} ${entry.home} x ${entry.away} | ${pick.stat} ${pick.teamTarget} "${pick.line}" | ${oldResult}→${result} (actual: ${oldActual}→${actualValue})`);
          pick.result = result;
          pick.actualValue = actualValue;
          ticketChanged = true;
          totalFixed++;
        }

        if (result !== 'WON') { matchGreen = false; allGreen = false; }
      }

      const oldEntryResult = entry.result || entry.matchResult;
      const newEntryResult = matchGreen ? 'WON' : 'LOST';
      if (oldEntryResult !== newEntryResult) {
        console.log(`  🔄 Entry result: ${oldEntryResult} → ${newEntryResult}`);
        entry.result = newEntryResult;
        entry.matchResult = newEntryResult;
        ticketChanged = true;
      }
    }

    const newStatus = hasIncomplete ? 'PENDING' : allGreen ? 'WON' : 'LOST';
    if (newStatus !== ticket.status) {
      console.log(`  🎯 Ticket status: ${ticket.status} → ${newStatus}`);
    }

    if (ticketChanged || newStatus !== ticket.status) {
      if (!dryRun) {
        const { error } = await supabase.from('odd_tickets')
          .update({ status: newStatus, ticket_data: ticket.ticket_data })
          .eq('date', ticket.date).eq('mode', ticket.mode);
        if (error) console.error(`  ❌ Erro ao salvar: ${error.message}`);
        else console.log(`  ✅ Salvo!`);
      }
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`  Picks verificados: ${totalChecked}`);
  console.log(`  Picks corrigidos: ${totalFixed}`);
  if (dryRun && totalFixed > 0) {
    console.log(`\n⚡ Execute com --apply para salvar as correções no banco.`);
  }
}

reevaluateJune().catch(console.error);
