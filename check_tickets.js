import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env.local', 'utf8');
const env = envText.split('\n').reduce((acc, line) => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) acc[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  // Check today's tickets
  const { data } = await supabase.from('odd_tickets')
    .select('date, mode, ticket_data, matches_count, total_odd')
    .eq('date', '2026-07-12')
    .in('mode', ['2.0', '3.0', 'opp']);

  for (const t of (data || [])) {
    console.log(`\n=== ${t.mode} (odd: ${t.total_odd}, jogos: ${t.matches_count}) ===`);
    if (t.mode === 'opp') {
      const opps = t.ticket_data?.opportunities || [];
      // Show opps that have odd 0
      const zeroOdd = opps.filter(o => !o.odd || o.odd === 0);
      console.log(`  Total oportunidades: ${opps.length}, Com odd 0: ${zeroOdd.length}`);
      if (zeroOdd.length > 0) {
        for (const z of zeroOdd) {
          console.log(`    ⚠️ ${z.home} x ${z.away} — ${z.market} ${z.line} @ ${z.odd} [${z.probability}%]`);
        }
      }
      // Show all odds for the two problematic games  
      const probGames = opps.filter(o => o.home?.includes('Operario') || o.home?.includes('Avai'));
      console.log(`  Picks dos jogos problemáticos:`);
      for (const p of probGames) {
        console.log(`    ${p.home} x ${p.away} — ${p.market} ${p.line} @ ${p.odd} [${p.probability}%]`);
      }
    } else {
      const entries = t.ticket_data?.entries || [];
      for (const e of entries) {
        console.log(`  ${e.home} x ${e.away}`);
        for (const p of (e.picks || [])) {
          console.log(`    [${p.probability}%] ${p.line} ${p.stat} (${p.period}) @ ${p.odd}`);
        }
      }
    }
  }
}
check();
