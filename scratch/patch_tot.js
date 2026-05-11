
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

async function patchTicket() {
    console.log("Fetching ticket 2.0 for today...");
    const { data: ticket } = await supabase.from('odd_tickets').select('*').eq('date', '2026-05-11').eq('mode', '2.0').single();
    
    if (!ticket) {
        console.log("Ticket not found"); return;
    }
    
    const tData = ticket.ticket_data;
    
    tData.entries.forEach(entry => {
        if (entry.home === 'Tottenham' && entry.away === 'Leeds') {
            entry.picks.forEach(p => {
                if (p.team === 'Tottenham' && p.stat === 'GOLS') {
                    console.log(`Reverting pick: ${p.line} -> Menos de 2.5`);
                    p.line = 'Menos de 2.5';
                    p.threshold = 2.5;
                    p.odd = 1.30;
                    p.probability = 100;
                }
            });
        }
    });
    
    // Recalculate total odd
    let totalOdd = 1;
    tData.entries.forEach(e => {
        e.picks.forEach(p => totalOdd *= p.odd);
    });
    
    const finalOdd = totalOdd.toFixed(2);
    console.log(`Restored total odd: ${finalOdd}`);
    
    await supabase.from('odd_tickets').update({
        ticket_data: tData,
        total_odd: finalOdd
    }).eq('id', ticket.id);
    
    console.log("Ticket reverted successfully!");
}
patchTicket();
