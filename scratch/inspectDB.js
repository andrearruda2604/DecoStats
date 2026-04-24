import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    console.log("Supabase URL:", env.VITE_SUPABASE_URL);
    
    // Tentar listar tabelas
    const { data: stats, error: sErr } = await supabase.from('match_stats').select('*').limit(1);
    if (sErr) console.error("Erro em match_stats:", sErr.message);
    else console.log("Dados em match_stats:", stats);

    const { data: tix, error: tErr } = await supabase.from('odd_tickets').select('*').limit(1);
    if (tErr) console.error("Erro em odd_tickets:", tErr.message);
    else console.log("Dados em odd_tickets:", tix);
}

inspect();
