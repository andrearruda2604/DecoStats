import fs from 'fs';
import path from 'path';

const SCRIPTS_DIR = 'c:/Users/camil/OneDrive/Documentos/Andre/projetos/DecoStats/scripts';
const filesToPatch = [
  'generateOdd2.js',
  'generateOdd3.js',
  'generateOdd3_preview.js',
  'generateOpportunities.js',
  'generateOpportunitiesCups.js'
];

function patchFile(file) {
  const filePath = path.join(SCRIPTS_DIR, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update MARKETS
  const oldMarkets = `  169:{ label: 'Cartões 1° Tempo (T)',  stat: 'CARTÕES',     period: 'HT', teamTarget: 'TOTAL' },
  170:{ label: 'Cartões 1° Tempo (C)',  stat: 'CARTÕES',     period: 'HT', teamTarget: 'HOME'  },
  171:{ label: 'Cartões 1° Tempo (F)',  stat: 'CARTÕES',     period: 'HT', teamTarget: 'AWAY'  },`;

  const newMarkets = `  155:{ label: 'Cartões Amarelos 1° Tempo (T)', stat: 'CARTÕES_AMARELOS', period: 'HT', teamTarget: 'TOTAL' },
  309:{ label: 'Cartões Amarelos 1° Tempo (C)', stat: 'CARTÕES_AMARELOS', period: 'HT', teamTarget: 'HOME'  },
  310:{ label: 'Cartões Amarelos 1° Tempo (F)', stat: 'CARTÕES_AMARELOS', period: 'HT', teamTarget: 'AWAY'  },
  173:{ label: 'Faltas (Total)',         stat: 'FALTAS',     period: 'FT', teamTarget: 'TOTAL' },
  171:{ label: 'Faltas (Casa)',          stat: 'FALTAS',     period: 'FT', teamTarget: 'HOME'  },
  170:{ label: 'Faltas (Fora)',          stat: 'FALTAS',     period: 'FT', teamTarget: 'AWAY'  },
  281:{ label: 'Desarmes (Total)',       stat: 'DESARMES',   period: 'FT', teamTarget: 'TOTAL' },
  302:{ label: 'Desarmes (Casa)',        stat: 'DESARMES',   period: 'FT', teamTarget: 'HOME'  },
  301:{ label: 'Desarmes (Fora)',        stat: 'DESARMES',   period: 'FT', teamTarget: 'AWAY'  },`;

  if (content.includes(oldMarkets)) {
    content = content.replace(oldMarkets, newMarkets);
    console.log(`Patched MARKETS in ${file}`);
  }

  // 2. Update evaluateHistoricalFrequency Home Loop
  const homeLogicAdd = `    } else if (candidate.stat === 'CARTÕES_AMARELOS') {
      if (candidate.period === 'HT') {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.yellow_cards_ht != null) { actualValue = tot.yellow_cards_ht; isValid = true; }
        } else {
          const yc1h = match.stats_1h?.find(s => s.type === 'Yellow Cards');
          if (yc1h) { actualValue = parseInt(yc1h.value) || 0; isValid = true; }
        }
      }
    } else if (candidate.stat === 'FALTAS') {
      if (candidate.period === 'FT') {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.fouls != null) { actualValue = tot.fouls; isValid = true; }
        } else {
          const fouls = match.stats_ft?.find(s => s.type === 'Fouls');
          if (fouls) { actualValue = parseInt(fouls.value) || 0; isValid = true; }
        }
      }
    } else if (candidate.stat === 'DESARMES') {
      if (candidate.period === 'FT') {
        if (candidate.teamTarget === 'TOTAL') {
          const tot = matchTotals[match.fixture_id];
          if (tot && tot.tackles != null) { actualValue = tot.tackles; isValid = true; }
        } else {
          const tackles = match.stats_ft?.find(s => s.type === 'Total tackles' || s.type === 'Tackles');
          if (tackles) { actualValue = parseInt(tackles.value) || 0; isValid = true; }
        }
      }`;

  const homeLoopMarker = `    } else if (candidate.stat === 'CARTÕES') {`;
  if (!content.includes(`candidate.stat === 'CARTÕES_AMARELOS'`)) {
    content = content.replace(homeLoopMarker, homeLogicAdd + '\n' + homeLoopMarker);
    console.log(`Patched home loop logic in ${file}`);
  }

  // 3. Update evaluateHistoricalFrequency Away Loop
  const awayLogicAdd = `    } else if (candidate.stat === 'CARTÕES_AMARELOS') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'HT') { if (tot && tot.yellow_cards_ht != null) { actualValue = tot.yellow_cards_ht; isValid = true; } }
    } else if (candidate.stat === 'FALTAS') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'FT') { if (tot && tot.fouls != null) { actualValue = tot.fouls; isValid = true; } }
    } else if (candidate.stat === 'DESARMES') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'FT') { if (tot && tot.tackles != null) { actualValue = tot.tackles; isValid = true; } }`;

  const awayLoopMarker = `    } else if (candidate.stat === 'CARTÕES') {
      const tot = matchTotals[match.fixture_id];`;
  
  if (content.includes(awayLoopMarker) && !content.includes(`candidate.stat === 'CARTÕES_AMARELOS'`) && content.split(`} else if (candidate.stat === 'CARTÕES') {`).length > 2) {
      // Find the second instance which is the away loop
      let parts = content.split(awayLoopMarker);
      if (parts.length >= 3) {
          // The first match was the home loop (which we already modified, wait, the home loop didn't have "const tot = matchTotals" immediately)
          // Actually, let's just replace the away loop carefully.
          content = content.replace(awayLoopMarker, awayLogicAdd + '\n' + awayLoopMarker);
          console.log(`Patched away loop logic in ${file}`);
      } else {
          content = content.replace(awayLoopMarker, awayLogicAdd + '\n' + awayLoopMarker);
          console.log(`Patched away loop logic in ${file}`);
      }
  }

  // 4. Update matchTotals computation
  const matchTotalsInitOld = `if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, corners_ht: 0, cards: 0, cards_ht: 0, shots_on_goal: 0, shots_on_goal_count: 0, shots_total: 0, offsides: 0, goalkeeper_saves: 0 };`;
  const matchTotalsInitNew = `if (!matchTotals[row.fixture_id]) matchTotals[row.fixture_id] = { corners: 0, corners_ht: 0, cards: 0, cards_ht: 0, yellow_cards_ht: 0, fouls: 0, tackles: 0, shots_on_goal: 0, shots_on_goal_count: 0, shots_total: 0, offsides: 0, goalkeeper_saves: 0 };`;

  if (content.includes(matchTotalsInitOld)) {
      content = content.replace(matchTotalsInitOld, matchTotalsInitNew);
      console.log(`Patched matchTotals init in ${file}`);
  }

  const matchTotalsSumOld = `           matchTotals[row.fixture_id].cards_ht += (y1h + r1h);`;
  const matchTotalsSumNew = `           matchTotals[row.fixture_id].cards_ht += (y1h + r1h);
           matchTotals[row.fixture_id].yellow_cards_ht += y1h;
           const fouls = row.stats_ft?.find(s => s.type === 'Fouls')?.value || 0;
           matchTotals[row.fixture_id].fouls += fouls;
           const tackles = row.stats_ft?.find(s => s.type === 'Total tackles' || s.type === 'Tackles')?.value || 0;
           matchTotals[row.fixture_id].tackles += tackles;`;

  if (content.includes(matchTotalsSumOld) && !content.includes(`matchTotals[row.fixture_id].fouls += fouls;`)) {
      content = content.replace(matchTotalsSumOld, matchTotalsSumNew);
      console.log(`Patched matchTotals sum in ${file}`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

for (const file of filesToPatch) {
  patchFile(file);
}
