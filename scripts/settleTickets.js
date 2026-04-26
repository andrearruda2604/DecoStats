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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function settle() {
  console.log("Iniciando apuração de bilhetes DecoStats...");

  // 1. Pegar bilhetes pendentes
  const { data: tickets } = await supabase.from('odd_tickets').select('*').eq('status', 'PENDING');
  if (!tickets || tickets.length === 0) {
      console.log("Nenhum bilhete pendente encontrado.");
      return;
  }

  for (const t of tickets) {
      console.log(`\nApurando bilhete de ${t.date} (Odd ${t.total_odd})...`);
      const entries = t.ticket_data.entries;
      let allWon = true;
      let allFinished = true;

      for (const entry of entries) {
          // Pegar status e stats da partida
          const { data: fix } = await supabase.from('fixtures').select('*').eq('api_id', entry.fixture_id).single();
          
          if (!fix || fix.status !== 'FT') {
              console.log(`- Jogo ${entry.home} x ${entry.away} ainda não terminou ou está sem dados.`);
              allFinished = false;
              continue;
          }

          // Pegar estatísticas reais do banco (match_stats)
          const { data: stats } = await supabase.from('match_stats').select('*').eq('fixture_id', entry.fixture_id);
          
          for (const pick of entry.picks) {
              // Extrair valor real do mercado
              let actualValue = 0;
              const pickTeam = pick.teamTarget === 'HOME' ? fix.home_team_id : fix.away_team_id;
              
              if (pick.stat === 'GOLS MARCADOS') {
                  if (pick.period === 'HT') {
                      actualValue = pick.teamTarget === 'HOME' ? fix.score?.halftime?.home : fix.score?.halftime?.away;
                  } else if (pick.period === '2H') {
                      const ftH = fix.home_score || 0;
                      const ftA = fix.away_score || 0;
                      const htH = fix.score?.halftime?.home || 0;
                      const htA = fix.score?.halftime?.away || 0;
                      actualValue = pick.teamTarget === 'HOME' ? (ftH - htH) : (ftA - htA);
                  } else {
                      actualValue = pick.teamTarget === 'HOME' ? fix.home_score : fix.away_score;
                  }
                  actualValue = parseInt(actualValue || 0);
              } else {
                  // Mapeamento de tipos para match_stats
                  const typeMap = { 'ESCANTEIOS': 'Corner Kicks', 'CARTÃO AMARELO': 'Yellow Cards', 'CHUTES': 'Total Shots' };
                  const statType = typeMap[pick.stat] || pick.stat;
                  
                  const row = stats?.find(s => s.team_id === pickTeam && s.type === statType);
                  actualValue = row ? parseInt(row.value || 0) : 0;
              }

              // Avaliar se bateu (Over/Under)
              const lineVal = parseFloat(pick.line.split(' ').pop());
              const won = pick.type === 'OVER' ? (actualValue > lineVal) : (actualValue < lineVal);
              
              pick.result = won ? 'WON' : 'LOST';
              pick.actualValue = actualValue;
              if (!won) allWon = false;
              
              console.log(`  [${pick.period}] ${pick.team} ${pick.line}: Real ${actualValue} -> ${won ? '✅' : '❌'}`);
          }
      }

      if (allFinished) {
          const finalStatus = allWon ? 'WON' : 'LOST';
          await supabase.from('odd_tickets').update({ 
              status: finalStatus,
              ticket_data: t.ticket_data 
          }).eq('id', t.id);
          console.log(`Resultado Final do Bilhete: ${finalStatus === 'WON' ? '💹 GREEN' : '💔 RED'}`);
      }
  }
}

settle().catch(console.error);
