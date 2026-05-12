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

async function main() {
  const { data: ticket } = await supabase
    .from('odd_tickets')
    .select('*')
    .eq('date', '2026-05-12')
    .eq('mode', '2.0')
    .maybeSingle();

  if (!ticket) { console.log('Ticket não encontrado'); return; }

  const entries = ticket.ticket_data.entries;

  // Remove the "Total: Mais de 0.5 ESCANTEIOS (HT)" pick from Argentinos game
  const argentinos = entries.find(e => e.fixture_id === 1544850);
  if (argentinos) {
    const before = argentinos.picks.length;
    argentinos.picks = argentinos.picks.filter(p => 
      !(p.stat === 'ESCANTEIOS' && p.teamTarget === 'TOTAL' && p.period === 'HT')
    );
    console.log(`✓ Removido pick Escanteios Total HT (${before} → ${argentinos.picks.length} picks)`);
  }

  // Calculate average confidence from all picks
  const allPicks = entries.flatMap(e => e.picks);
  const probs = allPicks.map(p => p.probability).filter(p => p != null);
  const avgConfidence = probs.length > 0 ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : null;
  
  console.log(`\nPicks com probabilidade: ${probs.length}/${allPicks.length}`);
  console.log(`Confiança média: ${avgConfidence}%`);

  // Recalculate total odd (product of individual odds)
  const totalOdd = parseFloat(allPicks.reduce((acc, p) => acc * p.odd, 1).toFixed(2));
  console.log(`Odd total recalculada: ${totalOdd}`);

  const { error } = await supabase.from('odd_tickets')
    .update({ 
      ticket_data: { ...ticket.ticket_data, entries, confidence: avgConfidence },
      total_odd: totalOdd,
      matches_count: entries.length
    })
    .eq('date', '2026-05-12')
    .eq('mode', '2.0');

  if (error) { console.error('Erro:', error); return; }

  console.log('\n── BILHETE 2.0 FINAL ──\n');
  for (const e of entries) {
    console.log(`  ${e.home} x ${e.away}`);
    for (const p of e.picks) {
      console.log(`    ${p.team}: ${p.line} ${p.stat} (${p.period}) → odd ${p.odd} [${p.probability}%]`);
    }
    console.log('');
  }
  console.log(`  Odd Total: ${totalOdd}`);
  console.log(`  Confiança IA: ${avgConfidence}%`);
}

main().catch(console.error);
