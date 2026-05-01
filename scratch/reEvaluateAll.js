/**
 * Re-avalia TODOS os bilhetes Odd 2.0 existentes no banco.
 * Chama evaluateOdd2.js para cada data.
 */
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

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

async function main() {
  // Busca todos os bilhetes que NÃO são de hoje (hoje pode não ter terminado)
  const today = new Date().toISOString().split('T')[0];
  
  const { data: tickets } = await supabase
    .from('odd_tickets')
    .select('date, status, matches_count')
    .lt('date', today)
    .gt('matches_count', 0)
    .order('date', { ascending: true });

  if (!tickets || tickets.length === 0) {
    console.log('Nenhum bilhete encontrado.');
    return;
  }

  console.log(`\n=== Re-avaliando ${tickets.length} bilhetes ===\n`);

  for (const t of tickets) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📅 ${t.date} | Status atual: ${t.status}`);
    
    try {
      const output = execSync(`node scripts/evaluateOdd2.js ${t.date}`, {
        encoding: 'utf8',
        timeout: 30000,
      });
      console.log(output);
    } catch (e) {
      console.error(`Erro ao avaliar ${t.date}: ${e.message}`);
    }

    // Espera 3s entre cada bilhete (API rate limit)
    await new Promise(r => setTimeout(r, 3000));
  }

  // Resumo final
  const { data: results } = await supabase
    .from('odd_tickets')
    .select('date, status, total_odd')
    .lt('date', today)
    .gt('matches_count', 0)
    .order('date', { ascending: true });

  console.log('\n\n' + '═'.repeat(50));
  console.log('RESUMO FINAL');
  console.log('═'.repeat(50));
  
  let won = 0, lost = 0;
  for (const r of (results || [])) {
    const emoji = r.status === 'WON' ? '🟢' : r.status === 'LOST' ? '🔴' : '⏳';
    console.log(`${emoji} ${r.date} | Odd: ${r.total_odd} | ${r.status}`);
    if (r.status === 'WON') won++;
    if (r.status === 'LOST') lost++;
  }
  console.log(`\n✅ Green: ${won} | ❌ Red: ${lost} | Taxa: ${Math.round(won / (won + lost || 1) * 100)}%`);
}

main().catch(console.error);
