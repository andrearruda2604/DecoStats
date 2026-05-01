import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
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
const API_KEY = process.env.VITE_API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY || env.API_FOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
  console.error("Missing Credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

async function fetchWithRetry(url) {
  let retries = 3;
  while (retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      return data;
    } catch (err) {
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if (retries === 0) throw err;
    }
  }
}

const STAT_MAPPING = {
  'CHUTES': 'Total Shots',
  'CHUTES NO GOL': 'Shots on Goal',
  'ESCANTEIOS': 'Corner Kicks',
  'FALTAS COMETIDAS': 'Fouls',
  'CARTÃO AMARELO': 'Yellow Cards',
  'GOLS MARCADOS': 'Goals'
};

async function evaluateTicket() {
  let targetDate;
  if (process.argv[2]) {
    targetDate = process.argv[2];
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  console.log(`\n=== Avaliando Ticket Retro: ${targetDate} ===`);

  const { data: ticket, error } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('date', targetDate)
    .maybeSingle();

  if (error || !ticket) {
    console.log("Nenhum ticket PENDING encontrado para avaliar.");
    return;
  }

  const entries = ticket.ticket_data.entries || [];
  let allGreen = true;
  let evaluatedEntries = [];

  for (const entry of entries) {
    console.log(`\nAvaliando ${entry.home} x ${entry.away} (${entry.fixture_id})`);
    
    // Fetch stats from API-Football
    const statsData = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${entry.fixture_id}`);
    const teamsStats = statsData.response || [];

    // Also fetch fixture details to get Goals since Goals are not always in 'statistics' endpoint
    const fixData = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?id=${entry.fixture_id}`);
    const matchDetail = fixData.response?.[0];
    
    if (!matchDetail || !['FT', 'AET', 'PEN'].includes(matchDetail.fixture.status.short)) {
       console.log(`Partida não finalizada ou erro na API.`);
       allGreen = false;
       continue;
    }

    const homeGoals = matchDetail.goals.home || 0;
    const awayGoals = matchDetail.goals.away || 0;

    let matchGreen = true;
    for (const pick of entry.picks) {
        const line = pick.threshold !== undefined ? pick.threshold : parseFloat(pick.line.split(' ').pop());
        const isHome = pick.teamTarget === 'HOME';
        let actualValue = 0;

        if (pick.stat === 'GOLS' || pick.stat === 'GOLS MARCADOS') {
            const htHome = matchDetail.score?.halftime?.home || 0;
            const htAway = matchDetail.score?.halftime?.away || 0;
            if (pick.period === 'FT') {
                actualValue = pick.teamTarget === 'TOTAL' ? (homeGoals + awayGoals) : (isHome ? homeGoals : awayGoals);
            } else if (pick.period === 'HT') {
                actualValue = pick.teamTarget === 'TOTAL' ? (htHome + htAway) : (isHome ? htHome : htAway);
            } else if (pick.period === '2H') {
                const ftG = pick.teamTarget === 'TOTAL' ? (homeGoals + awayGoals) : (isHome ? homeGoals : awayGoals);
                const htG = pick.teamTarget === 'TOTAL' ? (htHome + htAway) : (isHome ? htHome : htAway);
                actualValue = ftG - htG;
            }
        } else {
            const translatedType = STAT_MAPPING[pick.stat] || pick.stat;
            const homeStatsArr = teamsStats.find(s => s.team.id === matchDetail.teams.home.id)?.statistics || [];
            const awayStatsArr = teamsStats.find(s => s.team.id === matchDetail.teams.away.id)?.statistics || [];
            
            let val = 0;
            if (pick.teamTarget === 'TOTAL') {
                const hStat = homeStatsArr.find(s => s.type === translatedType);
                const aStat = awayStatsArr.find(s => s.type === translatedType);
                val += hStat && hStat.value !== null ? parseInt(hStat.value) : 0;
                val += aStat && aStat.value !== null ? parseInt(aStat.value) : 0;
            } else {
                const teamStatsArr = isHome ? homeStatsArr : awayStatsArr;
                const statObj = teamStatsArr.find(s => s.type === translatedType);
                val = statObj && statObj.value !== null ? parseInt(statObj.value) : 0;
            }
            
            if (pick.period === 'HT') {
                actualValue = Math.floor(val / 2); // Approximation
            } else if (pick.period === '2H') {
                actualValue = Math.ceil(val / 2); // Approximation
            } else {
                actualValue = val;
            }
        }

        const isPickGreen = pick.type === 'UNDER' ? actualValue < line : actualValue > line;
        if (!isPickGreen) { matchGreen = false; allGreen = false; }
        
        pick.result = isPickGreen ? 'WON' : 'LOST';
        pick.actualValue = actualValue;
        
        console.log(`[${pick.result}] ${pick.period} ${pick.stat} ${pick.teamTarget} ${pick.type === 'UNDER' ? '<' : '>'} ${line} (Fez: ${actualValue})`);
    }
    
    entry.matchResult = matchGreen ? 'WON' : 'LOST';
    evaluatedEntries.push(entry);
    await new Promise(r => setTimeout(r, 1000));
  }

  ticket.ticket_data.entries = evaluatedEntries;
  const finalStatus = allGreen ? 'WON' : 'LOST';

  await supabase.from('odd_tickets').update({
     status: finalStatus,
     ticket_data: ticket.ticket_data
  }).eq('date', targetDate);

  console.log(`\nTicket Avaliado como: ${finalStatus}`);
}

evaluateTicket().catch(console.error);
