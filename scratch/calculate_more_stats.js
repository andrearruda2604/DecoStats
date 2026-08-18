import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const FIXTURE_ID = 1520716;

async function run() {
  const { data: fix, error: fixErr } = await supabase
    .from('fixtures')
    .select('*')
    .eq('api_id', FIXTURE_ID)
    .single();

  if (fixErr || !fix) {
    console.error('Error fetching fixture:', fixErr);
    return;
  }

  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, api_id, name')
    .in('id', [fix.home_team_id, fix.away_team_id]);

  const homeTeam = dbTeams.find(t => t.id === fix.home_team_id);
  const awayTeam = dbTeams.find(t => t.id === fix.away_team_id);

  if (!homeTeam || !awayTeam) {
    console.error('Teams not found');
    return;
  }

  const { data: homeHist } = await supabase
    .from('teams_history')
    .select('*')
    .eq('team_id', homeTeam.api_id)
    .order('match_date', { ascending: false });

  const { data: awayHist } = await supabase
    .from('teams_history')
    .select('*')
    .eq('team_id', awayTeam.api_id)
    .order('match_date', { ascending: false });

  const homeMatches = homeHist.filter(m => m.is_home); // Operário at Home
  const awayMatches = awayHist.filter(m => !m.is_home); // Juventude Away

  console.log(`Operário Home matches: ${homeMatches.length}`);
  console.log(`Juventude Away matches: ${awayMatches.length}`);

  const extractStat = (match, typeStr) => {
    const arr = match.stats_ft;
    const s = (arr || []).find(x => x.type === typeStr);
    if (s && s.value !== null) {
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value.replace('%', ''), 10);
      return parseInt(s.value, 10);
    }
    // Fallbacks
    if (typeStr === 'Corner Kicks' && match.corners != null) return match.corners;
    if (typeStr === 'Yellow Cards' && match.yellow_cards != null) return match.yellow_cards;
    if (typeStr === 'Red Cards' && match.red_cards != null) return match.red_cards;
    return null;
  };

  // 1. Total Corners (Jogo)
  // Operário Home Corners vs Juventude Away Corners
  let totalCornersHitsOver9_5 = 0;
  let totalCornersHitsUnder9_5 = 0;
  let cornersCount = 0;

  // 2. Home Corners (Operário)
  let homeCornersOver5_5 = 0;
  let homeCornersUnder5_5 = 0;

  // 3. Away Corners (Juventude)
  let awayCornersOver4_5 = 0;
  let awayCornersUnder4_5 = 0;

  // 4. Total Cards (Jogo)
  let totalCardsOver5_5 = 0;
  let totalCardsUnder5_5 = 0;
  let cardsCount = 0;

  // 5. Home Cards (Operário)
  let homeCardsOver2_5 = 0;
  let homeCardsUnder2_5 = 0;

  // 6. Away Cards (Juventude)
  let awayCardsOver2_5 = 0;
  let awayCardsUnder2_5 = 0;

  homeMatches.forEach(m => {
    const ck = extractStat(m, 'Corner Kicks');
    const yc = extractStat(m, 'Yellow Cards') || 0;
    const rc = extractStat(m, 'Red Cards') || 0;
    const cards = yc + rc;

    if (ck !== null) {
      if (ck > 5) homeCornersOver5_5++;
      else homeCornersUnder5_5++;
    }

    if (yc !== null) {
      if (cards > 2) homeCardsOver2_5++;
      else homeCardsUnder2_5++;
    }
  });

  awayMatches.forEach(m => {
    const ck = extractStat(m, 'Corner Kicks');
    const yc = extractStat(m, 'Yellow Cards') || 0;
    const rc = extractStat(m, 'Red Cards') || 0;
    const cards = yc + rc;

    if (ck !== null) {
      if (ck > 4) awayCornersOver4_5++;
      else awayCornersUnder4_5++;
    }

    if (yc !== null) {
      if (cards > 2) awayCardsOver2_5++;
      else awayCardsUnder2_5++;
    }
  });

  // For total corners and total cards in the game, let's see how many matches of both teams had these.
  // Actually, we can evaluate each match in homeMatches (Operário) and awayMatches (Juventude)
  // to get their individual overall/combined frequencies.
  const allMatchesCombined = [...homeMatches, ...awayMatches];
  allMatchesCombined.forEach(m => {
    const ck = extractStat(m, 'Corner Kicks');
    const yc = extractStat(m, 'Yellow Cards') || 0;
    const rc = extractStat(m, 'Red Cards') || 0;
    const cards = yc + rc;

    if (ck !== null) {
      cornersCount++;
      if (ck > 9.5) totalCornersHitsOver9_5++;
      else totalCornersHitsUnder9_5++;
    }

    if (yc !== null) {
      cardsCount++;
      if (cards > 5.5) totalCardsOver5_5++;
      else totalCardsUnder5_5++;
    }
  });

  console.log('\n--- Probabilities for New Markets ---');
  if (cornersCount > 0) {
    console.log(`Total Corners > 9.5: ${Math.round((totalCornersHitsOver9_5 / cornersCount) * 100)}% (${totalCornersHitsOver9_5}/${cornersCount})`);
    console.log(`Total Corners < 9.5: ${Math.round((totalCornersHitsUnder9_5 / cornersCount) * 100)}% (${totalCornersHitsUnder9_5}/${cornersCount})`);
  }
  if (homeMatches.length > 0) {
    console.log(`Operário Home Corners > 5.5: ${Math.round((homeCornersOver5_5 / homeMatches.length) * 100)}% (${homeCornersOver5_5}/${homeMatches.length})`);
    console.log(`Operário Home Corners < 5.5: ${Math.round((homeCornersUnder5_5 / homeMatches.length) * 100)}% (${homeCornersUnder5_5}/${homeMatches.length})`);
    console.log(`Operário Home Cards > 2.5: ${Math.round((homeCardsOver2_5 / homeMatches.length) * 100)}% (${homeCardsOver2_5}/${homeMatches.length})`);
    console.log(`Operário Home Cards < 2.5: ${Math.round((homeCardsUnder2_5 / homeMatches.length) * 100)}% (${homeCardsUnder2_5}/${homeMatches.length})`);
  }
  if (awayMatches.length > 0) {
    console.log(`Juventude Away Corners > 4.5: ${Math.round((awayCornersOver4_5 / awayMatches.length) * 100)}% (${awayCornersOver4_5}/${awayMatches.length})`);
    console.log(`Juventude Away Corners < 4.5: ${Math.round((awayCornersUnder4_5 / awayMatches.length) * 100)}% (${awayCornersUnder4_5}/${awayMatches.length})`);
    console.log(`Juventude Away Cards > 2.5: ${Math.round((awayCardsOver2_5 / awayMatches.length) * 100)}% (${awayCardsOver2_5}/${awayMatches.length})`);
    console.log(`Juventude Away Cards < 2.5: ${Math.round((awayCardsUnder2_5 / awayMatches.length) * 100)}% (${awayCardsUnder2_5}/${awayMatches.length})`);
  }
  if (cardsCount > 0) {
    console.log(`Total Cards > 5.5: ${Math.round((totalCardsOver5_5 / cardsCount) * 100)}% (${totalCardsOver5_5}/${cardsCount})`);
    console.log(`Total Cards < 5.5: ${Math.round((totalCardsUnder5_5 / cardsCount) * 100)}% (${totalCardsUnder5_5}/${cardsCount})`);
  }
}

run().catch(console.error);
