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

async function fetchHistoricalDistributions(homeTeamId, awayTeamId) {
    const { data: homeHistory } = await supabase
       .from('teams_history')
       .select('*')
       .eq('team_id', homeTeamId)
       .eq('is_home', true)
       .order('match_date', { ascending: false })
       .limit(20);

    const { data: awayHistory } = await supabase
       .from('teams_history')
       .select('*')
       .eq('team_id', awayTeamId)
       .eq('is_home', false)
       .order('match_date', { ascending: false })
       .limit(20);

    const metrics = [
        { key: 'Total Shots', label: 'CHUTES', flatKey: 'shots_total' },
        { key: 'Shots on Goal', label: 'CHUTES NO GOL', flatKey: 'shots_on_goal' },
        { key: 'Corner Kicks', label: 'ESCANTEIOS', flatKey: 'corners' },
        { key: 'Yellow Cards', label: 'CARTÃO AMARELO', flatKey: 'yellow_cards' },
        { key: 'goals', label: 'GOLS MARCADOS', flatKey: 'goals_for' }
    ];

    const processPeriod = (periodField) => {
        return metrics.map(m => {
            const getVal = (histList) => {
                if(!histList) return [];
                return histList.map(h => {
                    let val = null;
                    if (m.label === 'GOLS MARCADOS') {
                        if (periodField === 'stats_ft') val = h.goals_for;
                        else val = Math.floor((h.goals_for || 0) / (periodField === 'stats_1h' ? 2 : 2));
                    } else {
                        const arr = h[periodField];
                        if (arr && arr.length > 0) {
                            const found = arr.find(x => x.type === m.key);
                            if (found && found.value !== null) {
                                if (typeof found.value === 'string' && found.value.includes('%')) val = parseInt(found.value.replace('%',''), 10);
                                else val = parseInt(found.value, 10);
                            }
                        }
                        if (val === null && periodField === 'stats_ft') val = h[m.flatKey];
                    }
                    return val || 0;
                });
            };
            return { label: m.label, homeDist: getVal(homeHistory), awayDist: getVal(awayHistory) };
        });
    };

    return {
        FT: processPeriod('stats_ft'),
        HT: processPeriod('stats_1h'),
        '2H': processPeriod('stats_2h')
    };
}

const overLines = Array.from({length: 35}, (_, i) => i + 0.5);

// Extrai melhores probabilidades (desce de 100% até 80%) mesclando HT, FT, Over e Under
function extractTopPicks(homeTeam, awayTeam, data, bet365Odds) {
    let picks = [];
    
    ['FT', 'HT', '2H'].forEach(period => {
        if (!data[period]) return;
        const stats = data[period];
        
        stats.forEach(stat => {
            const hDist = stat.homeDist;
            const aDist = stat.awayDist;
            
            for (const line of overLines) {
                const hOver = hDist.filter(val => val > line).length;
                const aOver = aDist.filter(val => val > line).length;
                const hUnder = hDist.filter(val => val < line).length;
                const aUnder = aDist.filter(val => val < line).length;
                
                const processPick = (count, teamObj, target, type) => {
                    const prob = (count / hDist.length) * 100;
                    if (prob >= 80) {
                        picks.push({
                            team: teamObj.name,
                            teamTarget: target,
                            stat: stat.label,
                            period: period,
                            type: type,
                            line: type === 'OVER' ? `Mais de ${line}` : `Menos de ${line}`,
                            lineVal: line,
                            probability: prob,
                            odd: (1 + ((105 - prob)/200))
                        });
                    }
                };

                processPick(hOver, homeTeam, 'HOME', 'OVER');
                processPick(aOver, awayTeam, 'AWAY', 'OVER');
                processPick(hUnder, homeTeam, 'HOME', 'UNDER');
                processPick(aUnder, awayTeam, 'AWAY', 'UNDER');
            }
        });
    });

    if (picks.length === 0) return null;
    
    // Group the picks uniquely filtering out loose/redundant lines to find the "Tightest" safe line
    const tightestPicks = {};
    picks.forEach(p => {
        const key = `${p.team}_${p.stat}_${p.period}_${p.type}`;
        if (!tightestPicks[key]) {
            tightestPicks[key] = p;
        } else {
            const existing = tightestPicks[key];
            if (p.probability > existing.probability) {
                tightestPicks[key] = p;
            } else if (p.probability === existing.probability) {
                if (p.type === 'OVER' && p.lineVal > existing.lineVal) {
                    tightestPicks[key] = p;
                }
                if (p.type === 'UNDER' && p.lineVal < existing.lineVal) {
                    tightestPicks[key] = p;
                }
            }
        }
    });

    const bestPicks = Object.values(tightestPicks);
    
    // Filtramos para evitar contradições (ex: ter 'Mais de 2.5' e 'Menos de 4.5' da mesma stat pro mesmo time)
    // O mais provável/arrojado sobrevive. Ordem de relevância por melhor probability.
    bestPicks.sort((a, b) => b.probability - a.probability);

    const safePicks = [];
    const usedStatSignatures = new Set();
    
    for (const p of bestPicks) {
        const uniqueStatSig = `${p.team}_${p.stat}_${p.period}`;
        // Só deixamos passar 1 per stat per period per match
        if (!usedStatSignatures.has(uniqueStatSig)) {
            usedStatSignatures.add(uniqueStatSig);
            safePicks.push(p);
        }
    }

    return safePicks.slice(0, 4); // Bet builder limits: Max 4 options natively integrated to simulate the bet builder multi-cross
}

async function generateOdd2() {
  const today = process.argv[2] || new Date().toISOString().split('T')[0];
  const startOfDay = `${today} 00:00:00+00`;
  const endOfDay = `${today} 23:59:59+00`;
  console.log(`Buscando jogos de hoje (${today}) para Odd 2.0...`);

  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*)')
    .gte('date', startOfDay)
    .lte('date', endOfDay);

  if (error || !fixtures) {
    console.error("Erro buscando fixtures:", error);
    return;
  }

  console.log(`Encontrados ${fixtures.length} jogos.`);
  
  const ticketEntries = [];
  let simulatedOdd = 1.0;
  
  for (const m of fixtures) {
      // Logic: Only add matches until we reach the targeted Odd 2.0
      if (simulatedOdd >= 2.0) break;

      if (['PST', 'NS'].includes(m.status)) {
          const predictive = await fetchHistoricalDistributions(m.home_team_id, m.away_team_id);
          const rawOdds = m.odds; 
          
          const picks = extractTopPicks(m.home, m.away, predictive, rawOdds);
          
          if (picks && picks.length > 0) {
              const matchOdd = picks.reduce((acc, p) => acc * p.odd, 1.0);
              simulatedOdd *= matchOdd;
              
              ticketEntries.push({
                  fixture_id: m.api_id,
                  home: m.home.name,
                  away: m.away.name,
                  homeLogo: m.home.logo_url,
                  awayLogo: m.away.logo_url,
                  date_time: m.date,
                  picks: picks
              });
          }
      }
  }

  const finalTicket = {
      entries: ticketEntries,
      confidence_score: (1 / simulatedOdd * 100).toFixed(0), // Simple confidence inverse of risk
      generated_at: new Date().toISOString()
  };

  const matchesCount = ticketEntries.length;

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
