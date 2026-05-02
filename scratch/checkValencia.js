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

async function run() {
  const valenciaId = 532;
  const { data: homeHistory } = await supabase.from('teams_history').select('*').eq('team_id', valenciaId).eq('season', 2025).eq('is_home', true);
  
  let cardsOver1_5 = 0;
  for (const m of homeHistory) {
     const y = m.stats_ft?.find(s => s.type === 'Yellow Cards')?.value || 0;
     const r = m.stats_ft?.find(s => s.type === 'Red Cards')?.value || 0;
     if ((y + r) > 1.5) cardsOver1_5++;
  }
  console.log(`Valencia had > 1.5 cards in ${cardsOver1_5} out of ${homeHistory.length} games (${Math.round((cardsOver1_5/homeHistory.length)*100)}%)`);
}
run();
