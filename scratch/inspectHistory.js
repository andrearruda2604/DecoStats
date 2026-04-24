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
    const dates = ['2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24'];
    console.log("🔍 INSPECIONANDO BILHETES NO BANCO:");
    
    const { data: tickets } = await supabase
        .from('odd_tickets')
        .select('date, total_odd, matches_count, status')
        .in('date', dates);

    console.table(tickets);
}

inspect();
