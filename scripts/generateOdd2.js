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

async function fetchHistoricalDistributions(homeTeamId, awayTeamId) {
    const metrics = [
        { key: 'Total Shots', label: 'CHUTES' },
        { key: 'Corner Kicks', label: 'ESCANTEIOS' },
        { key: 'Yellow Cards', label: 'CARTÃO AMARELO' },
        { key: 'goals', label: 'GOLS MARCADOS' }
    ];

    const getStats = async (tid) => {
        const { data } = await supabase.from('teams_history').select('*').eq('team_id', tid).order('match_date', { ascending: false }).limit(30);
        return data || [];
    };

    const homeHistory = await getStats(homeTeamId);
    const awayHistory = await getStats(awayTeamId);

    const processPeriod = (periodField) => {
        return metrics.map(m => {
            const getVal = (hist) => hist.map(h => {
                if (m.key === 'goals') {
                    if (periodField === 'stats_ft') return (h.goals_for || 0);
                    if (periodField === 'stats_1h') return (h.score?.halftime?.home !== undefined ? h.score.halftime.home : 0);
                    return 0;
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
  // Define "Today" em Brasília (UTC-3)
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = process.argv[2] || brt.toISOString().split('T')[0];
  
  const { data: fixtures } = await supabase.from('fixtures')
    .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*)')
    .gte('date', `${today} 00:00:00+00`).lte('date', `${today} 23:59:59+00`);

  if (!fixtures) return;

  const ticketEntries = [];
  let simulatedOdd = 1.0;

  for (const m of fixtures.sort((a,b) => new Date(a.date) - new Date(b.date))) {
      if (simulatedOdd >= 2.8) break; 
      if (!['NS', 'TBD', 'FT', '1H', '2H', 'HT', 'LIVE'].includes(m.status)) continue;

      const predictive = await fetchHistoricalDistributions(m.home_team_id, m.away_team_id);
      const picks = [];

      const evaluate = (periodStats, label) => {
          periodStats.forEach(stat => {
              let lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 7.5, 8.5];
              if (stat.key === 'Total Shots') lines = [7.5, 9.5, 11.5, 13.5];
              if (stat.key === 'Corner Kicks' && label === 'FT') lines = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5];

              lines.forEach(line => {
                  const check = (dist, teamName, target) => {
                      if (dist.length < 8) return;
                      const over = (dist.filter(v => v > line).length / dist.length) * 100;
                      const under = (dist.filter(v => v < line).length / dist.length) * 100;

                      const pushIf = (prob, type) => {
                          // RÉGUA MATEMÁTICA: 75% a 95% (Evitar teto da Bet365)
                          if (prob >= 75 && prob <= 95) { 
                              const oddVal = parseFloat((1 + ((105 - prob) / 85)).toFixed(2));
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

  const avgConfidence = ticketEntries.length > 0 ? (ticketEntries.flatMap(e => e.picks).reduce((a,b)=>a+b.probability,0) / (ticketEntries.length * 2)).toFixed(0) : 0;

  await supabase.from('odd_tickets').upsert({
      date: today, matches_count: ticketEntries.length, total_odd: simulatedOdd.toFixed(2),
      status: 'PENDING',
      ticket_data: { entries: ticketEntries, confidence_score: avgConfidence, generated_at: new Date().toISOString() }
  }, { onConflict: 'date' });

  console.log(`Bilhete Odd 2.0 Gerado: Odd ${simulatedOdd.toFixed(2)} (${ticketEntries.length} jogos)`);
}

generateOdd2().catch(console.error);
