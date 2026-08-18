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
  // 1. Get Fixture and Odds
  const { data: fix, error: fixErr } = await supabase
    .from('fixtures')
    .select('*')
    .eq('api_id', FIXTURE_ID)
    .single();

  if (fixErr || !fix) {
    console.error('Error fetching fixture:', fixErr);
    return;
  }

  // 2. Fetch Teams History
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

  console.log(`Match: ${homeTeam.name} vs ${awayTeam.name}`);

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

  console.log(`Home history records: ${homeHist?.length || 0}`);
  console.log(`Away history records: ${awayHist?.length || 0}`);

  // Helper to extract stats
  const extractStat = (match, typeStr, period = 'FT') => {
    const arr = period === '1H' || period === 'HT' ? match.stats_1h : period === '2H' ? match.stats_2h : match.stats_ft;
    const s = (arr || []).find(x => x.type === typeStr);
    if (s && s.value !== null) {
      if (typeof s.value === 'string' && s.value.includes('%')) return parseInt(s.value.replace('%', ''), 10);
      return parseInt(s.value, 10);
    }
    // Fallbacks
    if (period === 'FT') {
      if (typeStr === 'Total Shots' && match.shots_total != null) return match.shots_total;
      if (typeStr === 'Shots on Goal' && match.shots_on_goal != null) return match.shots_on_goal;
      if (typeStr === 'Corner Kicks' && match.corners != null) return match.corners;
      if (typeStr === 'Offsides' && match.offsides != null) return match.offsides;
      if (typeStr === 'Yellow Cards' && match.yellow_cards != null) return match.yellow_cards;
    }
    return null;
  };

  // Evaluate candidate probabilities
  const calcProb = (conditionFn) => {
    const homeMatches = homeHist.filter(m => m.is_home);
    const awayMatches = awayHist.filter(m => !m.is_home);

    let homeHits = 0, homeValid = 0;
    for (const m of homeMatches) {
      const val = conditionFn(m, 'HOME');
      if (val !== null) {
        homeValid++;
        if (val) homeHits++;
      }
    }

    let awayHits = 0, awayValid = 0;
    for (const m of awayMatches) {
      const val = conditionFn(m, 'AWAY');
      if (val !== null) {
        awayValid++;
        if (val) awayHits++;
      }
    }

    const homePct = homeValid > 0 ? (homeHits / homeValid) * 100 : null;
    const awayPct = awayValid > 0 ? (awayHits / awayValid) * 100 : null;

    return {
      homePct, homeHits, homeValid,
      awayPct, awayHits, awayValid,
      combinedPct: (homeValid + awayValid) > 0 ? ((homeHits + awayHits) / (homeValid + awayValid)) * 100 : null
    };
  };

  // Define market evaluations
  const evaluations = {
    // Goals Jogo
    'Gols Jogo Over 0.5': () => calcProb(m => (m.goals_for + m.goals_against) > 0),
    'Gols Jogo Over 1.5': () => calcProb(m => (m.goals_for + m.goals_against) > 1),
    'Gols Jogo Under 2.5': () => calcProb(m => (m.goals_for + m.goals_against) < 3),
    'Gols Jogo Under 3.5': () => calcProb(m => (m.goals_for + m.goals_against) < 4),
    // Goals Team
    'Gols Operario Over 0.5': () => calcProb((m, side) => side === 'HOME' ? m.goals_for > 0 : null),
    'Gols Operario Over 1.5': () => calcProb((m, side) => side === 'HOME' ? m.goals_for > 1 : null),
    'Gols Juventude Over 0.5': () => calcProb((m, side) => side === 'AWAY' ? m.goals_for > 0 : null), // goals_for is Juventude since we filtered is_home === false
    // Corners Jogo
    'Corners Over 7.5': () => calcProb(m => { const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 7 : null; }),
    'Corners Over 8.5': () => calcProb(m => { const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 8 : null; }),
    'Corners Over 9.5': () => calcProb(m => { const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 9 : null; }),
    // Corners Team
    'Corners Operario Over 2.5': () => calcProb((m, side) => { if (side !== 'HOME') return null; const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 2 : null; }),
    'Corners Operario Over 3.5': () => calcProb((m, side) => { if (side !== 'HOME') return null; const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 3 : null; }),
    'Corners Juventude Over 2.5': () => calcProb((m, side) => { if (side !== 'AWAY') return null; const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 2 : null; }),
    'Corners Juventude Over 3.5': () => calcProb((m, side) => { if (side !== 'AWAY') return null; const ck = extractStat(m, 'Corner Kicks'); return ck !== null ? ck > 3 : null; }),
    // Cards Jogo
    'Cartões Over 3.5': () => calcProb(m => { const yc = extractStat(m, 'Yellow Cards'); const rc = extractStat(m, 'Red Cards') || 0; return yc !== null ? (yc + rc) > 3 : null; }),
    'Cartões Over 4.5': () => calcProb(m => { const yc = extractStat(m, 'Yellow Cards'); const rc = extractStat(m, 'Red Cards') || 0; return yc !== null ? (yc + rc) > 4 : null; }),
    // Outcomes
    'Dupla Chance Operario ou Empate': () => calcProb((m, side) => side === 'HOME' ? m.goals_for >= m.goals_against : null),
    'Dupla Chance Juventude ou Empate': () => calcProb((m, side) => side === 'AWAY' ? m.goals_for >= m.goals_against : null),
    'Ambos Marcam Sim': () => calcProb(m => m.goals_for > 0 && m.goals_against > 0),
    'Ambos Marcam Nao': () => calcProb(m => !(m.goals_for > 0 && m.goals_against > 0))
  };

  const matchBets = fix.odds || [];
  console.log(`Odds available in database: ${matchBets.length} bet types`);

  const results = [];

  // Parse bets to find matching odds and compute probabilities
  for (const bet of matchBets) {
    if (bet.id === 1) { // 1x2
      console.log('\n--- 1x2 Odds ---');
      for (const val of bet.values) {
        console.log(`  - ${val.value}: ${val.odd}`);
      }
    }
    
    if (bet.id === 12) { // Double Chance
      console.log('\n--- Double Chance Odds ---');
      for (const val of bet.values) {
        console.log(`  - ${val.value}: ${val.odd}`);
        if (val.value === 'Home/Draw') {
          const prob = evaluations['Dupla Chance Operario ou Empate']();
          results.push({ name: 'Dupla Chance - Operário ou Empate', odd: parseFloat(val.odd), prob: Math.round(prob.homePct) });
        }
        if (val.value === 'Draw/Away') {
          const prob = evaluations['Dupla Chance Juventude ou Empate']();
          results.push({ name: 'Dupla Chance - Juventude ou Empate', odd: parseFloat(val.odd), prob: Math.round(prob.awayPct) });
        }
      }
    }

    if (bet.id === 8) { // Ambos Marcam
      console.log('\n--- Ambos Marcam Odds ---');
      for (const val of bet.values) {
        console.log(`  - ${val.value}: ${val.odd}`);
        if (val.value === 'Yes') {
          const prob = evaluations['Ambos Marcam Sim']();
          results.push({ name: 'Ambos Marcam - Sim', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
        }
        if (val.value === 'No') {
          const prob = evaluations['Ambos Marcam Nao']();
          results.push({ name: 'Ambos Marcam - Não', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
        }
      }
    }

    if (bet.id === 5) { // Goals Jogo Over/Under
      console.log('\n--- Goals Over/Under Odds ---');
      for (const val of bet.values) {
        console.log(`  - ${val.value}: ${val.odd}`);
        if (val.value === 'Over 0.5') {
          const prob = evaluations['Gols Jogo Over 0.5']();
          results.push({ name: 'Mais de 0.5 Gols no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
        }
        if (val.value === 'Over 1.5') {
          const prob = evaluations['Gols Jogo Over 1.5']();
          results.push({ name: 'Mais de 1.5 Gols no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
        }
        if (val.value === 'Under 2.5') {
          const prob = evaluations['Gols Jogo Under 2.5']();
          results.push({ name: 'Menos de 2.5 Gols no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
        }
        if (val.value === 'Under 3.5') {
          const prob = evaluations['Gols Jogo Under 3.5']();
          results.push({ name: 'Menos de 3.5 Gols no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
        }
      }
    }
  }

  // Handle Corners
  const cornerBet = matchBets.find(b => b.id === 45); // Total Corners
  if (cornerBet) {
    console.log('\n--- Corners Odds ---');
    for (const val of cornerBet.values) {
      console.log(`  - ${val.value}: ${val.odd}`);
      if (val.value === 'Over 7.5') {
        const prob = evaluations['Corners Over 7.5']();
        results.push({ name: 'Mais de 7.5 Escanteios no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
      }
      if (val.value === 'Over 8.5') {
        const prob = evaluations['Corners Over 8.5']();
        results.push({ name: 'Mais de 8.5 Escanteios no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
      }
      if (val.value === 'Over 9.5') {
        const prob = evaluations['Corners Over 9.5']();
        results.push({ name: 'Mais de 9.5 Escanteios no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
      }
    }
  }

  // Handle Cards
  const cardsBet = matchBets.find(b => b.id === 80); // Total Cards
  if (cardsBet) {
    console.log('\n--- Cards Odds ---');
    for (const val of cardsBet.values) {
      console.log(`  - ${val.value}: ${val.odd}`);
      if (val.value === 'Over 3.5') {
        const prob = evaluations['Cartões Over 3.5']();
        results.push({ name: 'Mais de 3.5 Cartões no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
      }
      if (val.value === 'Over 4.5') {
        const prob = evaluations['Cartões Over 4.5']();
        results.push({ name: 'Mais de 4.5 Cartões no Jogo', odd: parseFloat(val.odd), prob: Math.round(resPct(prob)) });
      }
    }
  }

  function resPct(res) {
    return res.combinedPct || res.homePct || res.awayPct || 0;
  }

  console.log('\n==========================================');
  console.log('🌟 CANDIDATE PICKS WITH PROBABILITY > 50% 🌟');
  console.log('==========================================');
  
  const validPicks = results.filter(p => p.prob > 50 && !isNaN(p.prob));
  validPicks.sort((a,b) => b.prob - a.prob);

  for (const pick of validPicks) {
    console.log(`- ${pick.name}: Prob: ${pick.prob}% | Odd: ${pick.odd.toFixed(2)}`);
  }
}

run().catch(console.error);
