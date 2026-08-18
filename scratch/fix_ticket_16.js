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
} catch (e) { }

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: ticket } = await supabase.from('odd_tickets')
    .select('*')
    .eq('date', '2026-07-16')
    .eq('mode', '2.0')
    .maybeSingle();

  if (!ticket) { console.log('No ticket found'); return; }

  const entries = ticket.ticket_data?.entries || [];

  // Find Vasco entry
  const vascoIdx = entries.findIndex(e => (e.away || '').toLowerCase().includes('vasco'));
  if (vascoIdx === -1) { console.log('Vasco entry not found'); return; }

  const vascoEntry = entries[vascoIdx];
  console.log('BEFORE:');
  console.log('  Entry result:', vascoEntry.result);
  for (const p of vascoEntry.picks) {
    console.log(`  Pick: ${p.market} ${p.line} | result=${p.result} actualValue=${p.actualValue} type=${p.type} stat=${p.stat} teamTarget=${p.teamTarget}`);
  }

  // Fetch the fixture score
  const { data: fix } = await supabase.from('fixtures')
    .select('home_score, away_score, ht_home_score, ht_away_score, status')
    .eq('api_id', vascoEntry.fixture_id)
    .maybeSingle();

  if (!fix || !['FT', 'AET', 'PEN'].includes(fix.status)) {
    console.log('Fixture not finished or not found');
    return;
  }

  console.log(`\nFixture: Vitoria ${fix.home_score} x ${fix.away_score} Vasco (${fix.status})`);

  // Re-evaluate each pick
  for (const p of vascoEntry.picks) {
    if (p.stat === 'GOLS_SOFRIDOS' && p.teamTarget === 'AWAY') {
      // Gols sofridos pelo Vasco (fora) = gols marcados pelo Vitória (casa) = home_score
      const actualValue = fix.home_score;
      let result;
      if (p.type === 'NO') {
        // NO clean sheet = sofreu gols
        result = actualValue > 0 ? 'WON' : 'LOST';
      } else if (p.type === 'YES') {
        result = actualValue === 0 ? 'WON' : 'LOST';
      } else if (p.type === 'OVER') {
        result = actualValue > p.threshold ? 'WON' : 'LOST';
      } else if (p.type === 'UNDER') {
        result = actualValue < p.threshold ? 'WON' : 'LOST';
      }
      console.log(`\n  RE-EVAL: ${p.market} ${p.line}`);
      console.log(`    actualValue: ${p.actualValue} -> ${actualValue}`);
      console.log(`    result: ${p.result} -> ${result}`);
      p.actualValue = actualValue;
      p.result = result;
    } else if (p.stat === 'ESCANTEIOS') {
      // Already correct (WON with actualValue=3)
      console.log(`  KEEP: ${p.market} ${p.line} = ${p.result} (actualValue=${p.actualValue})`);
    }
  }

  // Re-evaluate entry result (all picks must be WON)
  const allWon = vascoEntry.picks.every(p => p.result === 'WON');
  const anyLost = vascoEntry.picks.some(p => p.result === 'LOST');
  vascoEntry.result = anyLost ? 'LOST' : allWon ? 'WON' : vascoEntry.result;
  vascoEntry.matchResult = vascoEntry.result;

  console.log('\nAFTER:');
  console.log('  Entry result:', vascoEntry.result);
  for (const p of vascoEntry.picks) {
    console.log(`  Pick: ${p.market} ${p.line} | result=${p.result} actualValue=${p.actualValue}`);
  }

  // Re-evaluate ticket status
  entries[vascoIdx] = vascoEntry;
  const ticketAllWon = entries.every(e => e.result === 'WON');
  const ticketAnyLost = entries.some(e => e.result === 'LOST');
  const newStatus = ticketAnyLost ? 'LOST' : ticketAllWon ? 'WON' : ticket.status;

  console.log(`\nTicket status: ${ticket.status} -> ${newStatus}`);

  // Save
  const { error } = await supabase.from('odd_tickets')
    .update({
      status: newStatus,
      ticket_data: { ...ticket.ticket_data, entries }
    })
    .eq('date', '2026-07-16')
    .eq('mode', '2.0');

  if (error) console.error('SAVE ERROR:', error.message);
  else console.log('\n✅ Ticket atualizado com sucesso!');
}

main().catch(console.error);
