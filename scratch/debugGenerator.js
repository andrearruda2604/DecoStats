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

async function debug() {
    const today = '2026-04-24';
    console.log(`\n--- DEBUG GERADOR 24/04 ---`);
    
    const { data: fixtures } = await supabase.from('fixtures')
        .select('*, home:teams!home_team_id(*), away:teams!away_team_id(*)')
        .gte('date', `${today} 00:00:00+00`).lte('date', `${today} 23:59:59+00`);

    console.log(`Total de jogos no banco: ${fixtures?.length || 0}`);

    for (const m of fixtures || []) {
        console.log(`\nPartida: ${m.home.name} vs ${m.away.name} (Status: ${m.status})`);
        
        // Simular o fetch de histórico
        const { data: hHist } = await supabase.from('teams_history').select('*').eq('team_id', m.home_team_id).limit(30);
        const { data: aHist } = await supabase.from('teams_history').select('*').eq('team_id', m.away_team_id).limit(30);
        
        console.log(`   - Jogos no histórico: Home(${hHist?.length}) Away(${aHist?.length})`);

        if (hHist?.length >= 8) {
            const over05 = (hHist.filter(h => h.goals_for > 0.5).length / hHist.length) * 100;
            console.log(`   - Home Prob > 0.5 Gols: ${over05.toFixed(1)}%`);
        }
    }
}

debug();
