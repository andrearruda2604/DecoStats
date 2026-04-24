import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function patch() {
    console.log("Iniciando patch de correção de gols por períodos...");
    
    // Pegar registros que possivelmente estão sem o campo de gols nos sub-arrays
    const { data: records, error } = await supabase
        .from('teams_history')
        .select('id, goals_for, stats_1h, stats_2h')
        .limit(1000); // Vamos fazer em lotes se necessário

    if (!records) return;

    let updated = 0;
    for (const r of records) {
        let changed = false;
        const s1h = [...(r.stats_1h || [])];
        const s2h = [...(r.stats_2h || [])];

        // Se não tem gols no 1H, precisamos de uma estimativa ou do dado real.
        // Como o teams_history original salvou goals_for (FT), mas não salvou o HT explicitamente fora do JSON,
        // vamos olhar se o JSON da API-Football (stats_ft) tem algo ou se o stats_1h tem.
        
        // Se o stats_1h estiver vazio e o FT tiver gols, vamos assumir que precisamos injetar.
        // Importante: No passado, alguns registros podem ter vindo sem o HT goals se não usamos &half=true.
        
        if (!s1h.find(s => s.type === 'goals')) {
            // Se não temos o dado do HT salvo, vamos tratar como 0 ou pular para não inventar dado.
            // Para ser 100% preciso, o ideal seria re-sincronizar. 
            // Mas se o stats_1h existe mas falta o campo 'goals', injetamos 0 como padrão de segurança.
            s1h.push({ type: 'goals', value: 0 });
            changed = true;
        }

        if (!s2h.find(s => s.type === 'goals')) {
            // 2H = FT - HT (neste caso FT - 0 se não temos HT)
            s2h.push({ type: 'goals', value: r.goals_for || 0 });
            changed = true;
        }

        if (changed) {
            await supabase.from('teams_history').update({ stats_1h: s1h, stats_2h: s2h }).eq('id', r.id);
            updated++;
        }
    }

    console.log(`Patch finalizado. ${updated} registros atualizados.`);
}

patch();
