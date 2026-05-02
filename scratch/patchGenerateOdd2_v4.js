import fs from 'fs';

const file = 'scripts/generateOdd2.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Bet 77
content = content.replace(
  "45: { label: 'Escanteios FT (Total)'",
  "77: { label: 'Escanteios 1T (Total)',stat:'ESCANTEIOS',period: 'HT', teamTarget: 'TOTAL' },\n  45: { label: 'Escanteios FT (Total)'"
);

// 2. Add stats_1h to ESCANTEIOS in evaluateHistoricalFrequency
content = content.replace(
  "} else if (candidate.stat === 'ESCANTEIOS') {\n      if (candidate.teamTarget === 'TOTAL') actualValue = matchTotals[match.fixture_id]?.corners || 0;\n      else actualValue = match.corners || 0;",
  "} else if (candidate.stat === 'ESCANTEIOS') {\n      if (candidate.period === 'HT') {\n        if (candidate.teamTarget === 'TOTAL') {\n           const ock = matchTotals[match.fixture_id]?.corners_ht || 0; actualValue = ock;\n        } else {\n           const ck = match.stats_1h?.find(s => s.type === 'Corner Kicks'); actualValue = ck ? ck.value : 0;\n        }\n      } else {\n        if (candidate.teamTarget === 'TOTAL') actualValue = matchTotals[match.fixture_id]?.corners || 0;\n        else actualValue = match.corners || 0;\n      }"
);

// Do the same for awayHistory
content = content.replace(
  "} else if (candidate.stat === 'ESCANTEIOS') {\n      if (candidate.teamTarget === 'TOTAL') actualValue = matchTotals[match.fixture_id]?.corners || 0;\n      else actualValue = match.corners || 0;",
  "} else if (candidate.stat === 'ESCANTEIOS') {\n      if (candidate.period === 'HT') {\n        if (candidate.teamTarget === 'TOTAL') {\n           const ock = matchTotals[match.fixture_id]?.corners_ht || 0; actualValue = ock;\n        } else {\n           const ck = match.stats_1h?.find(s => s.type === 'Corner Kicks'); actualValue = ck ? ck.value : 0;\n        }\n      } else {\n        if (candidate.teamTarget === 'TOTAL') actualValue = matchTotals[match.fixture_id]?.corners || 0;\n        else actualValue = match.corners || 0;\n      }"
);

// Add corners_ht to matchTotals computation
content = content.replace(
  "matchTotals[row.fixture_id].corners += (row.corners || 0);",
  "matchTotals[row.fixture_id].corners += (row.corners || 0);\n           const ck_ht = row.stats_1h?.find(s => s.type === 'Corner Kicks');\n           matchTotals[row.fixture_id].corners_ht = (matchTotals[row.fixture_id].corners_ht || 0) + (ck_ht ? ck_ht.value : 0);"
);

// Update matchTotals query to include stats_1h
content = content.replace(
  ".select('fixture_id, corners, stats_ft')",
  ".select('fixture_id, corners, stats_ft, stats_1h')"
);

// Change MIN_HISTORICAL_PROB logic
content = content.replace(
  "if (histProb !== null && histProb >= MIN_HISTORICAL_PROB) {",
  "const requiredProb = market.stat === 'GOLS' ? 85 : 60;\n        if (histProb !== null && histProb >= requiredProb) {"
);

// Diversify selection in buildAccumulator
content = content.replace(
  "available.sort((a, b) => b.probability - a.probability || b.odd - a.odd);",
  "available.sort((a, b) => {\n      const goalsCount = selected.filter(c => c.stat === 'GOLS').length;\n      if (goalsCount >= 2) {\n        if (a.stat === 'GOLS' && b.stat !== 'GOLS') return 1;\n        if (b.stat === 'GOLS' && a.stat !== 'GOLS') return -1;\n      }\n      return b.probability - a.probability || b.odd - a.odd;\n    });"
);

// Replace the fallback sorting too
content = content.replace(
  ".sort((a, b) => b.probability - a.probability || b.odd - a.odd);",
  ".sort((a, b) => {\n      const goalsCount = selected.filter(c => c.stat === 'GOLS').length;\n      if (goalsCount >= 2) {\n        if (a.stat === 'GOLS' && b.stat !== 'GOLS') return 1;\n        if (b.stat === 'GOLS' && a.stat !== 'GOLS') return -1;\n      }\n      return b.probability - a.probability || b.odd - a.odd;\n    });"
);

fs.writeFileSync(file, content);
console.log('generateOdd2.js updated for diversification');
