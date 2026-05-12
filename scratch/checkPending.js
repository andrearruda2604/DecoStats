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
const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY };

async function main() {
  // Real results from API:
  // Talleres 0-1 Belgrano (FT) - fixture 1544176
  // Boca Juniors 2-3 Huracan (AET) - fixture 1544177
  
  // Fetch full details
  const [tallRes, bocaRes] = await Promise.all([
    fetch('https://v3.football.api-sports.io/fixtures?id=1544176', { headers }).then(r => r.json()),
    fetch('https://v3.football.api-sports.io/fixtures?id=1544177', { headers }).then(r => r.json()),
  ]);
  
  const talleres = tallRes.response[0];
  const boca = bocaRes.response[0];
  
  console.log(`Talleres ${talleres.goals.home}-${talleres.goals.away} Belgrano (${talleres.fixture.status.short})`);
  console.log(`  HT: ${talleres.score.halftime.home}-${talleres.score.halftime.away}`);
  console.log(`Boca ${boca.goals.home}-${boca.goals.away} Huracan (${boca.fixture.status.short})`);
  console.log(`  HT: ${boca.score.halftime.home}-${boca.score.halftime.away}`);
  console.log(`  FT (90min): ${boca.score.fulltime.home}-${boca.score.fulltime.away}`);
  console.log(`  ET: ${boca.score.extratime.home}-${boca.score.extratime.away}`);
  
  // Map of old fixture_id -> real match data
  const matchResults = {
    1384594: { // Talleres vs Belgrano
      home: talleres.goals.home, away: talleres.goals.away,
      htHome: talleres.score.halftime.home || 0, htAway: talleres.score.halftime.away || 0,
      status: talleres.fixture.status.short,
      // For AET, use 90-min scores
      ft90Home: talleres.goals.home, ft90Away: talleres.goals.away,
    },
    1384587: { // Boca vs Huracan
      // AET game: use 90-min scores for FT picks
      home: boca.score.fulltime.home, away: boca.score.fulltime.away,
      htHome: boca.score.halftime.home || 0, htAway: boca.score.halftime.away || 0,
      status: boca.fixture.status.short,
      ft90Home: boca.score.fulltime.home, ft90Away: boca.score.fulltime.away,
    },
  };
  
  // Load ticket
  const { data: ticket } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('date', '2026-05-09')
    .eq('mode', '3.0')
    .maybeSingle();
  
  if (!ticket) { console.log('No ticket'); return; }
  
  const entries = ticket.ticket_data.entries;
  let allGreen = true;
  
  for (const entry of entries) {
    const mr = matchResults[entry.fixture_id];
    if (!mr) {
      // Already evaluated
      if (entry.result === 'LOST') allGreen = false;
      continue;
    }
    
    console.log(`\nAvaliando ${entry.home} x ${entry.away} (${entry.fixture_id})`);
    let matchGreen = true;
    
    for (const pick of entry.picks) {
      const threshold = pick.threshold ?? parseFloat(String(pick.line).replace(/.*de\s+/i, ''));
      let actual = 0;
      const teamTarget = pick.teamTarget || (pick.team === entry.home ? 'HOME' : pick.team === entry.away ? 'AWAY' : 'TOTAL');
      
      // Use 90-min scores for FT period
      const homeG = mr.ft90Home ?? mr.home;
      const awayG = mr.ft90Away ?? mr.away;
      
      if (pick.stat === 'GOLS' || pick.stat === 'GOLS MARCADOS') {
        if (pick.period === 'FT') {
          if (teamTarget === 'TOTAL') actual = homeG + awayG;
          else if (teamTarget === 'HOME') actual = homeG;
          else actual = awayG;
        }
      }
      
      const type = pick.type || (pick.line?.includes('Menos') ? 'UNDER' : 'OVER');
      const won = type === 'OVER' ? actual > threshold : actual < threshold;
      pick.result = won ? 'WON' : 'LOST';
      pick.actualValue = actual;
      pick.type = type;
      pick.teamTarget = teamTarget;
      
      if (!won) { matchGreen = false; allGreen = false; }
      console.log(`  [${pick.result}] ${pick.period} ${pick.stat} ${teamTarget} ${type === 'UNDER' ? '<' : '>'} ${threshold} (Fez: ${actual})`);
    }
    
    entry.result = matchGreen ? 'WON' : 'LOST';
    entry.matchResult = entry.result;
  }
  
  const hasLost = entries.some(e => e.result === 'LOST');
  const hasPending = entries.some(e => e.result === 'PENDING' || !e.result);
  const finalStatus = hasLost ? 'LOST' : hasPending ? 'PENDING' : 'WON';
  
  console.log(`\n=== Ticket 3.0 (09/05): ${finalStatus} ===`);
  
  await supabase.from('odd_tickets').update({
    status: finalStatus,
    ticket_data: { ...ticket.ticket_data, entries }
  }).eq('date', '2026-05-09').eq('mode', '3.0');
  
  console.log('✓ Ticket atualizado no banco.');
}

main().catch(console.error);
