import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis no ambiente local
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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchHistoricalDistributions(homeTeamId, awayTeamId) {
    const metrics = [
        { key: 'Total Shots', label: 'CHUTES', flatKey: 'shots_total' },
        { key: 'Corner Kicks', label: 'ESCANTEIOS', flatKey: 'corners' },
        { key: 'Yellow Cards', label: 'CARTÃO AMARELO', flatKey: 'yellow_cards' },
        { key: 'goals', label: 'GOLS MARCADOS', flatKey: 'goals_for' }
    ];

    const getStats = async (tid, isHome) => {
        const { data } = await supabase.from('teams_history').select('*').eq('team_id', tid).eq('is_home', isHome).order('match_date', { ascending: false }).limit(20);
        return data || [];
    };

    const homeHistory = await getStats(homeTeamId, true);
    const awayHistory = await getStats(awayTeamId, false);

    const processPeriod = (periodField) => {
        return metrics.map(m => {
            const getVal = (hist) => hist.map(h => {
                if (m.label === 'GOLS MARCADOS') {
                    if (periodField === 'stats_ft') return h.goals_for || 0;
                    const st = h[periodField]?.find(s => s.type === 'goals');
                    return st ? parseInt(st.value) : 0;
                }
                const st = h[periodField]?.find(s => s.type === m.key);
                return st ? parseInt(st.value) : 0;
            });
            return {
                key: m.key,
                label: m.label,
                hDist: getVal(homeHistory),
                aDist: getVal(awayHistory)
            };
        });
    };

    return {
        stats_ft: processPeriod('stats_ft'),
        stats_1h: processPeriod('stats_1h'),
        stats_2h: processPeriod('stats_2h')
    };
}

async function generateOdd2() {
  const today = process.argv[2] || new Date().toISOString().split('T')[0];
  const startOfDay = `${today} 00:00:00+00`;
  const endOfDay = `${today} 23:59:59+00`;
  
  const { data: fixtures } = await supabase.from('fixtures')
    .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*)')
    .gte('date', startOfDay).lte('date', endOfDay);

  if (!fixtures) return;

  const ticketEntries = [];
  let simulatedOdd = 1.0;

  for (const m of fixtures) {
      if (simulatedOdd >= 2.2) break;
      if (!['NS', 'PST'].includes(m.status)) continue;

      const predictive = await fetchHistoricalDistributions(m.home_team_id, m.away_team_id);
      const picks = [];

      const evaluate = (periodStats, label) => {
          periodStats.forEach(stat => {
              // Lines to check - Dynamic based on median
              let lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
              
              if (stat.key === 'Total Shots') {
                  const median = stat.hDist.length > 0 ? stat.hDist.sort((a,b)=>a-b)[Math.floor(stat.hDist.length/2)] : 10;
                  // Bet365 for balance: start a bit below median and go up in steps of 2.0
                  const startLine = Math.max(7.5, Math.floor(median - 4) + 0.5);
                  lines = [startLine, startLine + 2, startLine + 4, startLine + 6, startLine + 8];
              } else if (label === 'FT' && stat.key === 'Corner Kicks') {
                  lines = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5];
              }
              
              lines.forEach(line => {
                  const check = (dist, teamName, target) => {
                      if (dist.length < 5) return;
                      const over = (dist.filter(v => v > line).length / dist.length) * 100;
                      const under = (dist.filter(v => v < line).length / dist.length) * 100;

                      const pushIf = (prob, type) => {
                          // Bet365 Safety: Avoid lines that are too "obvious" (prob > 97%) as they won't have markets
                          if (prob >= 70 && prob <= 96) { 
                              const oddVal = parseFloat((1 + ((105 - prob) / 80)).toFixed(2));
                              picks.push({
                                  team: teamName, teamTarget: target, stat: stat.label, period: label,
                                  type, line: `${type === 'OVER' ? 'Mais de' : 'Menos de'} ${line}`,
                                  probability: Math.round(prob), odd: oddVal
                              });
                          }
                      };
                      pushIf(over, 'OVER');
                      pushIf(under, 'UNDER');
                  };
                  check(stat.hDist, m.home.name, 'HOME');
                  check(stat.aDist, m.away.name, 'AWAY');
              });
          });
      };

      evaluate(predictive.stats_ft, 'FT');
      evaluate(predictive.stats_1h, 'HT');
      evaluate(predictive.stats_2h, '2H');

      // Pick best entry for this match
      picks.sort((a,b) => b.probability - a.probability);
      const uniquePicks = [];
      const used = new Set();
      for(const p of picks) {
          if (!used.has(p.stat + p.period) && uniquePicks.length < 2) {
              uniquePicks.push(p);
              used.add(p.stat + p.period);
          }
      }

      if (uniquePicks.length > 0) {
          const matchOdd = uniquePicks.reduce((acc, p) => acc * p.odd, 1.0);
          simulatedOdd *= matchOdd;
          ticketEntries.push({
              fixture_id: m.api_id, home: m.home.name, away: m.away.name,
              homeLogo: m.home.logo_url, awayLogo: m.away.logo_url, 
              date_time: m.date, picks: uniquePicks
          });
      }
  }

  const matchesCount = ticketEntries.length;
  await supabase.from('odd_tickets').upsert({
      date: today, matches_count: matchesCount, total_odd: simulatedOdd.toFixed(2),
      status: 'PENDING',
      ticket_data: { entries: ticketEntries, confidence_score: (1/simulatedOdd*100).toFixed(0), generated_at: new Date().toISOString() }
  }, { onConflict: 'date' });

  console.log(`Bilhete Odd 2.0 Gerado: Odd ${simulatedOdd.toFixed(2)} (${matchesCount} jogos)`);
}

generateOdd2().catch(console.error);
