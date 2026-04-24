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
  const { data } = await supabase.from('fixtures').select('date, status, home_team:home_team_id(name), away_team:away_team_id(name)')
    .gte('date', '2026-04-21')
    .lte('date', '2026-04-23')
    .order('date');
  
  console.log("Jogos encontrados entre 21 e 23/04:");
  console.table(data?.map(d => ({ 
      Data: d.date.split('T')[0], 
      Jogo: `${d.home_team.name} x ${d.away_team.name}`,
      Status: d.status 
  })));
}

check();
