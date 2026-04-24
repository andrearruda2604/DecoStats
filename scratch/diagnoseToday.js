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

async function diagnose() {
    const today = '2026-04-24';
    console.log(`\n🔍 Analisando jogos de ${today}...`);
    
    const { data: fixtures } = await supabase.from('fixtures')
        .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*)')
        .gte('date', `${today} 00:00:00+00`).lte('date', `${today} 23:59:59+00`);

    if (!fixtures || fixtures.length === 0) {
        console.log("Nenhum jogo encontrado no banco.");
        return;
    }

    for (const m of fixtures) {
        console.log(`\n⚽ ${m.home.name} vs ${m.away.name}`);
        
        // Verificar se tem histórico
        const { count: hCount } = await supabase.from('teams_history').select('*', { count: 'exact', head: true }).eq('team_id', m.home_team_id);
        const { count: aCount } = await supabase.from('teams_history').select('*', { count: 'exact', head: true }).eq('team_id', m.away_team_id);
        
        console.log(`   - Histórico em base: Home(${hCount}) Away(${aCount})`);
        
        if (hCount < 30 || aCount < 30) {
            console.log(`   ⚠️ ALERTA: Um dos times tem menos de 30 jogos. Rodando sync total...`);
        }
    }
}

diagnose();
