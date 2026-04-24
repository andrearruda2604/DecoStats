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

async function probe() {
    const homeId = 543; // Betis
    const awayId = 541; // Real Madrid
    
    const getStats = async (tid) => {
        const { data } = await supabase.from('teams_history').select('*').eq('team_id', tid).order('match_date', { ascending: false }).limit(30);
        return data || [];
    };

    const hHist = await getStats(homeId);
    const aHist = await getStats(awayId);

    console.log(`\n📊 PROBABILIDADES MATEMÁTICAS: Real Betis vs Real Madrid`);
    console.log(`Base: ${hHist.length} jogos p/ cada.`);

    const checkLine = (label, line, hVals, aVals) => {
        const overH = (hVals.filter(v => v > line).length / hVals.length) * 100;
        const overA = (aVals.filter(v => v > line).length / aVals.length) * 100;
        console.log(`   - ${label} > ${line}: HOME(${overH.toFixed(1)}%) AWAY(${overA.toFixed(1)}%)`);
    };

    // Gols
    const hGoals = hHist.map(h => h.goals_for);
    const aGoals = aHist.map(h => h.goals_for);
    checkLine('Gols', 0.5, hGoals, aGoals);
    checkLine('Gols', 1.5, hGoals, aGoals);

    // Escanteios
    const hCorn = hHist.map(h => h.stats_ft?.find(s=>s.type==='Corner Kicks')?.value || 0);
    const aCorn = aHist.map(h => h.stats_ft?.find(s=>s.type==='Corner Kicks')?.value || 0);
    checkLine('Cantos', 3.5, hCorn, aCorn);
    checkLine('Cantos', 4.5, hCorn, aCorn);
}

probe();
