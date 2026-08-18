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

async function check() {
  // Get all June 2026 tickets
  const { data: tickets } = await supabase
    .from('odd_tickets')
    .select('date, mode, status, ticket_data')
    .gte('date', '2026-06-01')
    .lte('date', '2026-06-30')
    .in('mode', ['2.0', '3.0'])
    .order('date');

  console.log(`Found ${tickets.length} tickets in June 2026\n`);

  // Collect all unique stat+type+period combinations
  const combos = new Set();
  const statCounts = {};
  let totalPicks = 0;
  let wrongPicks = [];
  
  for (const t of tickets) {
    const entries = t.ticket_data?.entries || [];
    for (const e of entries) {
      for (const p of e.picks) {
        totalPicks++;
        const key = `${p.stat}|${p.type}|${p.period}`;
        combos.add(key);
        statCounts[p.stat] = (statCounts[p.stat] || 0) + 1;
      }
    }
  }

  console.log('=== Stat distribution ===');
  for (const [stat, count] of Object.entries(statCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${stat}: ${count} picks`);
  }
  
  console.log(`\nTotal picks: ${totalPicks}`);
  console.log(`\n=== All stat|type|period combos ===`);
  for (const c of [...combos].sort()) {
    console.log(`  ${c}`);
  }
  
  // Show all dates with their statuses
  console.log('\n=== Tickets by date ===');
  for (const t of tickets) {
    const entries = t.ticket_data?.entries || [];
    const eCount = entries.length;
    const pCount = entries.reduce((a, e) => a + (e.picks?.length || 0), 0);
    console.log(`  ${t.date} | ${t.mode} | ${t.status} | ${eCount} entries, ${pCount} picks`);
  }
}

check().catch(console.error);
