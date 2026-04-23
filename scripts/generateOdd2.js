import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis no ambiente local
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getSeededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Emulate UI predictive generator for finding 100% metrics
function generatePredictiveData(homeTeamId, awayTeamId, count = 5) {
  const seedBase = homeTeamId * 1000 + awayTeamId + 1;
  const periods = ['FT', 'HT', '2H'];
  
  const predictiveConf = [
    { key: 'shots_total', label: 'CHUTES', baseH: 10, rangeH: 6, baseA: 8, rangeA: 5 },
    { key: 'shots_on_goal', label: 'CHUTES NO GOL', baseH: 4, rangeH: 3, baseA: 3, rangeA: 2 },
    { key: 'corners', label: 'ESCANTEIOS', baseH: 4, rangeH: 5, baseA: 3, rangeA: 4 },
    { key: 'fouls', label: 'FALTAS COMETIDAS', baseH: 10, rangeH: 4, baseA: 12, rangeA: 4 },
    { key: 'yellow_cards', label: 'CARTÃO AMARELO', baseH: 1, rangeH: 2, baseA: 1, rangeA: 2 },
    { key: 'goals_for', label: 'GOLS MARCADOS', baseH: 1, rangeH: 2, baseA: 1, rangeA: 2 }
  ];

  const result = {};
  for (const period of periods) {
     const mult = period === 'FT' ? 1 : period === 'HT' ? 0.45 : 0.55;
     result[period] = predictiveConf.map((cfg, i) => {
        const hSeed = seedBase + i * 10 + (period === 'FT' ? 1 : period === 'HT' ? 2 : 3);
        const aSeed = seedBase * 2 + i * 10 + (period === 'FT' ? 1 : period === 'HT' ? 2 : 3);
        
        const hMin = Math.round(cfg.baseH * mult + getSeededRandom(hSeed) * 2);
        const hMax = hMin + Math.round(cfg.rangeH * mult + getSeededRandom(hSeed + 10) * 2);
        const hDist = Array.from({length: count}, (_, j) => Math.floor(Math.max(hMin, Math.min(hMax, (hMin + hMax)/2 + (getSeededRandom(hSeed + 20 + j) - 0.5) * cfg.rangeH))));

        const aMin = Math.round(cfg.baseA * mult + getSeededRandom(aSeed) * 2);
        const aMax = aMin + Math.round(cfg.rangeA * mult + getSeededRandom(aSeed + 10) * 2);
        const aDist = Array.from({length: count}, (_, j) => Math.floor(Math.max(aMin, Math.min(aMax, (aMin + aMax)/2 + (getSeededRandom(aSeed + 20 + j) - 0.5) * cfg.rangeA))));

        return { label: cfg.label, homeDist: hDist, awayDist: aDist };
     });
  }
  return result;
}

const overLines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5];

// Extrai melhores probabilidades (desce de 100% até 80%)
function extractTopPicks(homeTeam, awayTeam, data, bet365Odds) {
    const picks = [];
    const ftStats = data['FT'];
    
    ftStats.forEach(stat => {
        const hDist = stat.homeDist;
        const aDist = stat.awayDist;
        
        for (const line of overLines) {
            const hOver = hDist.filter(val => val > line).length;
            const aOver = aDist.filter(val => val > line).length;
            
            const hPct = (hOver / 5) * 100;
            const aPct = (aOver / 5) * 100;
            
            if (hPct >= 80) {
                picks.push({
                   team: homeTeam.name,
                   teamTarget: 'HOME',
                   stat: stat.label,
                   line: `Over ${line}`,
                   probability: hPct
                });
            }
            if (aPct >= 80) {
                picks.push({
                   team: awayTeam.name,
                   teamTarget: 'AWAY',
                   stat: stat.label,
                   line: `Over ${line}`,
                   probability: aPct
                });
            }
        }
    });

    if (picks.length === 0) return null;
    
    // Sort picks by highest probability, then by most aggressive line (highest line value)
    picks.sort((a, b) => {
        if (b.probability !== a.probability) return b.probability - a.probability;
        const lineA = parseFloat(a.line.split(' ')[1]);
        const lineB = parseFloat(b.line.split(' ')[1]);
        return lineB - lineA;
    });

    // Group to prevent duplicate stats on the same team
    const bestPicks = {};
    for (const p of picks) {
       const key = `${p.team}_${p.stat}`;
       if (!bestPicks[key]) {
           bestPicks[key] = p;
       }
    }
    
    const finalPicks = Object.values(bestPicks);
    return finalPicks.slice(0, 2); // Limita a 2 picks por partida
}

async function generateOdd2() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Buscando jogos de hoje (${today}) para Odd 2.0...`);

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*)')
    .eq('date', today);

  if (error || !fixtures) {
    console.error("Erro buscando fixtures:", error);
    return;
  }

  console.log(`Encontrados ${fixtures.length} jogos.`);
  
  const ticketEntries = [];
  
  for (const m of fixtures) {
      if (['PST', 'NS'].includes(m.status) || true) { // Permitir todos para testes
          const predictive = generatePredictiveData(m.home_team_id, m.away_team_id, 5);
          const rawOdds = m.odds; // JSONB from api-football
          
          const picks = extractTopPicks(m.home, m.away, predictive, rawOdds);
          
          if (picks && picks.length > 0) {
              ticketEntries.push({
                  fixture_id: m.api_id,
                  home: m.home.short_name,
                  away: m.away.short_name,
                  date_time: m.date,
                  picks: picks
              });
          }
      }
  }

  let simulatedOdd = 1.0;
  let matchesCount = ticketEntries.length;
  let totalProbability = 0;
  let totalPicks = 0;
  
  ticketEntries.forEach(t => t.picks.forEach(p => { 
      simulatedOdd *= (1 + ((105 - p.probability)/200)); // Simula odd (ex: 100% -> 1.02, 80% -> 1.12)
      totalProbability += p.probability;
      totalPicks++;
  }));

  const avgConfidence = totalPicks > 0 ? (totalProbability / totalPicks).toFixed(1) : 0;

  const finalTicket = {
      entries: ticketEntries,
      confidence_score: avgConfidence,
      generated_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabase
    .from('odd_tickets')
    .upsert({
        date: today,
        matches_count: matchesCount,
        total_odd: simulatedOdd.toFixed(2),
        ticket_data: finalTicket,
        status: 'PENDING'
    }, {onConflict: 'date'});

  if (upsertError) {
      console.error("Erro salvando odd_ticket:", upsertError);
  } else {
      console.log(`\nBilhete Odd 2.0 Criado com Sucesso!`);
      console.log(`Total de Jogos Envolvidos: ${matchesCount}`);
      console.log(`Odd Final do Bilhete: ${simulatedOdd.toFixed(2)}`);
  }
}

generateOdd2().catch(console.error);
