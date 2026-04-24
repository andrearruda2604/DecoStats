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

async function check() {
    const date = '2026-04-21';
    const startOfDay = `${date} 00:00:00+00`;
    const endOfDay = `${date} 23:59:59+00`;

    const { count, error } = await supabase
        .from('fixtures')
        .select('*', { count: 'exact', head: true })
        .gte('date', startOfDay)
        .lte('date', endOfDay);

    console.log(`\n📅 Verificação para o dia ${date}:`);
    if (error) console.error("Erro:", error.message);
    else console.log(`Total de jogos encontrados: ${count}`);

    // Verificar se existe o bilhete
    const { data: ticket } = await supabase.from('odd_tickets').select('*').eq('date', date).maybeSingle();
    console.log(`Bilhete no banco: ${ticket ? 'EXISTE' : 'NÃO EXISTE'}`);
    if (ticket) console.log(`Matches Count no Bilhete: ${ticket.matches_count}`);
}

check();
