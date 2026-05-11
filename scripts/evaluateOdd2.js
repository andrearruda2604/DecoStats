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
  'CHUTES_GOL': 'Shots on Goal',
  'CHUTES NO GOL': 'Shots on Goal',
  'ESCANTEIOS': 'Corner Kicks',
  'FALTAS COMETIDAS': 'Fouls',
  'CARTÃO AMARELO': 'Yellow Cards',
  'CARTÕES': 'Yellow Cards',
  'GOLS MARCADOS': 'Goals',
  'GOLS': 'Goals',
  'DEFESAS': 'Goalkeeper Saves'
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
  let allGreen = true;
  let evaluatedEntries = [];

  let hasIncompleteMatch = false;
  for (const entry of entries) {
    console.log(`\nAvaliando ${entry.home} x ${entry.away} (${entry.fixture_id})`);
    
    // Fetch stats from API-Football with half=true to get period splits
    const statsData = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${entry.fixture_id}&half=true`);
    const teamsStats = statsData.response || [];

    // Also fetch fixture details to get Goals since Goals are not always in 'statistics' endpoint
    const fixData = await fetchWithRetry(`https://v3.football.api-sports.io/fixtures?id=${entry.fixture_id}`);
    const matchDetail = fixData.response?.[0];
    
    if (!matchDetail || !['FT', 'AET', 'PEN'].includes(matchDetail.fixture.status.short)) {
       console.log(`Partida não finalizada ou erro na API.`);
       hasIncompleteMatch = true;
       entry.matchResult = 'PENDING';
       entry.result = 'PENDING';
       evaluatedEntries.push(entry);
       continue;
    }

    const homeId = matchDetail.teams.home.id;
    const awayId = matchDetail.teams.away.id;

    // Fallback: Check if we have stats in our DB already
    const { data: dbStats } = await supabase.from('fixture_stats').select('*').eq('fixture_id', entry.fixture_id);

    const homeGoals = matchDetail.goals.home || 0;
    const awayGoals = matchDetail.goals.away || 0;

    let matchGreen = true;
    for (const pick of entry.picks) {
        let isAETPolluted = false;
        const line = pick.threshold !== undefined ? pick.threshold : parseFloat(pick.line.split(' ').pop());
        let teamTarget = pick.teamTarget;
        if (!teamTarget && pick.team) {
            if (pick.team === 'Total') teamTarget = 'TOTAL';
            else if (pick.team === entry.home) teamTarget = 'HOME';
            else if (pick.team === entry.away) teamTarget = 'AWAY';
        }
        
        const isHome = teamTarget === 'HOME';
        let actualValue = 0;
        let pType = pick.type;

        // Fallback for missing type
        if (!pType && pick.line) {
            if (pick.line.includes('Menos')) pType = 'UNDER';
            else if (pick.line.includes('Mais')) pType = 'OVER';
            else if (pick.line.includes('-')) pType = 'UNDER';
            else if (pick.line.includes('+')) pType = 'OVER';
        }
        
        // Save deduced properties back to pick for future use
        pick.teamTarget = teamTarget;
        pick.type = pType;

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
            const homeStatsObj = teamsStats.find(s => s.team.id === matchDetail.teams.home.id) || {};
            const awayStatsObj = teamsStats.find(s => s.team.id === matchDetail.teams.away.id) || {};
            
            let val = 0;
            const status = matchDetail.fixture.status.short;
            const isAET = ['AET', 'PEN'].includes(status);

            const getStatValue = (teamArr, tType, statKey = 'statistics') => {
                const arr = teamArr[statKey] || teamArr.statistics; // fallback to total if missing
                if (!arr) return 0;
                const statObj = arr.find(s => s.type === tType);
                return statObj && statObj.value !== null ? parseInt(statObj.value) : 0;
            };

            const getSumForPeriod = (statKey) => {
                if (pick.teamTarget === 'TOTAL') {
                    return getStatValue(homeStatsObj, translatedType, statKey) + 
                           getStatValue(awayStatsObj, translatedType, statKey);
                }
                return getStatValue(isHome ? homeStatsObj : awayStatsObj, translatedType, statKey);
            };

            if (pick.period === 'HT') {
                val = getSumForPeriod('statistics_1h');
            } else if (pick.period === '2H') {
                val = getSumForPeriod('statistics_2h');
            } else if (pick.period === 'FT' && isAET) {
                console.log(`🔍 Somando 1H+2H para garantir 90min (Status: ${status})`);
                const h1 = getSumForPeriod('statistics_1h');
                const h2 = getSumForPeriod('statistics_2h');
                
                if (h1 === 0 && h2 === 0) {
                    isAETPolluted = true;
                    val = getSumForPeriod('statistics'); // Fallback to total if periods are completely missing
                } else {
                    val = h1 + h2;
                }
            } else if (pick.period === 'FT') {
                val = getSumForPeriod('statistics');
            }

            // Fallback to DB if still 0
            if (val === 0 && dbStats && dbStats.length > 0) {
                const dbMatch = dbStats.find(s => s.period === pick.period && s.team_id === (isHome ? homeId : awayId));
                if (dbMatch) {
                    const dbField = translatedType.toLowerCase().replace(/ /g, '_');
                    const localMapping = { 'corner_kicks': 'corners', 'goalkeeper_saves': 'goalkeeper_saves', 'shots_on_goal': 'shots_on_goal' };
                    const field = localMapping[dbField] || dbField;
                    val = dbMatch[field] || 0;
                    if (val > 0) console.log(`📦 Fallback DB para ${pick.stat}: ${val}`);
                }
            }
            
            actualValue = val;
        }

        let isPickGreen = pType === 'UNDER' ? actualValue < line : actualValue > line;
        let result = isPickGreen ? 'WON' : 'LOST';

        if (isAETPolluted && isPickGreen) {
            result = 'CHECK';
            console.log(`⚠️ Marcar como CHECK (Prorrogação s/ dados separados)`);
        }

        if (!isPickGreen && result !== 'CHECK') { matchGreen = false; allGreen = false; }
        if (result === 'CHECK') { hasIncompleteMatch = true; } 
        
        pick.result = result;
        pick.actualValue = actualValue;
        
        console.log(`[${pick.result}] ${pick.period} ${pick.stat} ${pick.teamTarget} ${pick.type === 'UNDER' ? '<' : '>'} ${line} (Fez: ${actualValue})`);
    }
    
    entry.matchResult = matchGreen ? 'WON' : 'LOST';
    entry.result = entry.matchResult; // Sync both fields for UI compatibility
    evaluatedEntries.push(entry);
    await new Promise(r => setTimeout(r, 1000));
  }

  ticket.ticket_data.entries = evaluatedEntries;
  
  let finalStatus = 'PENDING';
  if (!allGreen) {
    finalStatus = 'LOST';
  } else if (!hasIncompleteMatch) {
    finalStatus = 'WON';
  }

  await supabase.from('odd_tickets').update({
     status: finalStatus,
     ticket_data: ticket.ticket_data
  }).eq('date', targetDate).eq('mode', ticket.mode);


    console.log(`Ticket ${ticket.mode} Avaliado como: ${finalStatus}`);
  }
}


evaluateTicket().catch(console.error);
