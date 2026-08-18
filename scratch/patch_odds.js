import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const RAW_ODDS = [1.012, 0.00, 2.62, 1.83, 1.05, 0, 1.062, 1.062, 1.16, 1.04, 1.05, 0, 0];

async function patch() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const targetDate = brt.toISOString().split('T')[0];

  const { data: existing } = await supabase.from('odd_tickets')
    .select('*').eq('date', targetDate).eq('mode', 'opp').single();

  if (!existing) {
    console.log('Nenhum bilhete opp encontrado para hoje.');
    return;
  }

  const opps = existing.ticket_data.opportunities;
  let j = 0;
  for (let i = 0; i < opps.length; i++) {
    if (opps[i].home === 'Fortaleza EC' || opps[i].home.includes('Fortaleza')) {
      if (j < RAW_ODDS.length) {
        opps[i].odd = RAW_ODDS[j];
        j++;
      }
    }
  }

  // Re-sort just in case, but keep original order logic (prob desc, odd desc)
  // Actually let's just save it.
  
  const { error } = await supabase.from('odd_tickets').update({
    ticket_data: {
      ...existing.ticket_data,
      opportunities: opps
    }
  }).eq('date', targetDate).eq('mode', 'opp');

  if (error) console.error(error);
  else {
    console.log('Odds do Fortaleza atualizadas com sucesso.');
    opps.filter(o => o.home.includes('Fortaleza')).forEach(o => {
      console.log(`- ${o.market} ${o.line}: ${o.odd}`);
    });
  }
}

patch().catch(console.error);
