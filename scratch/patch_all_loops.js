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

  // 1. matchTotals Init
  content = content.replace(
    /matchTotals\[row\.fixture_id\] = \{ corners: 0, corners_ht: 0, cards: 0, cards_ht: 0, shots_on_goal: 0, shots_on_goal_count: 0, shots_total: 0, (shots_total_count: 0, )?offsides: 0, goalkeeper_saves: 0 \};/g,
    "matchTotals[row.fixture_id] = { corners: 0, corners_ht: 0, cards: 0, cards_ht: 0, yellow_cards_ht: 0, fouls: 0, tackles: 0, shots_on_goal: 0, shots_on_goal_count: 0, shots_total: 0, shots_total_count: 0, offsides: 0, goalkeeper_saves: 0 };"
  );

  // 2. matchTotals sum (only add if not present)
  if (!content.includes("matchTotals[row.fixture_id].fouls +=")) {
    // some use `matchTotals[row.fixture_id].cards_ht +=` and others use `t.cards_ht +=`
    content = content.replace(
      /matchTotals\[row\.fixture_id\]\.cards_ht \+= \(y1h \+ r1h\);/g,
      `matchTotals[row.fixture_id].cards_ht += (y1h + r1h);
           matchTotals[row.fixture_id].yellow_cards_ht += y1h;
           const fouls = row.stats_ft?.find(s => s.type === 'Fouls')?.value || 0;
           matchTotals[row.fixture_id].fouls += fouls;
           const tackles = row.stats_ft?.find(s => s.type === 'Total tackles' || s.type === 'Tackles')?.value || 0;
           matchTotals[row.fixture_id].tackles += tackles;`
    );

    content = content.replace(
      /t\.cards_ht \+= \(y1h \+ r1h\);/g,
      `t.cards_ht += (y1h + r1h);
        t.yellow_cards_ht += y1h;
        const fouls = parseInt(row.stats_ft?.find(s => s.type === 'Fouls')?.value || 0);
        t.fouls += fouls;
        const tackles = parseInt(row.stats_ft?.find(s => s.type === 'Total tackles' || s.type === 'Tackles')?.value || 0);
        t.tackles += tackles;`
    );
  }

  // 3. evaluateHistoricalFrequency Away loop logic
  const awayLoopMarker = `    } else if (candidate.stat === 'CARTÕES') {
      const tot = matchTotals[match.fixture_id];`;

  const awayLogicAdd = `    } else if (candidate.stat === 'CARTÕES_AMARELOS') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'HT') { if (tot && tot.yellow_cards_ht != null) { actualValue = tot.yellow_cards_ht; isValid = true; } }
    } else if (candidate.stat === 'FALTAS') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'FT') { if (tot && tot.fouls != null) { actualValue = tot.fouls; isValid = true; } }
    } else if (candidate.stat === 'DESARMES') {
      const tot = matchTotals[match.fixture_id];
      if (candidate.period === 'FT') { if (tot && tot.tackles != null) { actualValue = tot.tackles; isValid = true; } }`;

  // Avoid duplicate replacement
  if (!content.includes(`candidate.stat === 'CARTÕES_AMARELOS'`) || content.split(`candidate.stat === 'CARTÕES_AMARELOS'`).length < 3) {
      if (content.includes(awayLoopMarker) && !content.includes(awayLogicAdd)) {
          // Careful replacement for the away loop
          const parts = content.split(awayLoopMarker);
          if (parts.length >= 2) {
              const beforeLast = parts.slice(0, parts.length - 1).join(awayLoopMarker);
              const last = parts[parts.length - 1];
              content = beforeLast + awayLogicAdd + '\n' + awayLoopMarker + last;
          }
      }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

for (const file of filesToPatch) {
  patchFile(file);
}
console.log("Patched all matchTotals and away loops.");
