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

async function checkAndRefill() {
    console.log("Buscando Cremonese...");
    const { data: team } = await supabase.from('teams').select('id, name, league_id').ilike('name', '%Cremonese%').single();
    
    if (!team) {
        console.log("Cremonese não encontrada no banco 'teams'.");
        return;
    }

    const { count } = await supabase.from('teams_history').select('*', { count: 'exact', head: true }).eq('team_id', team.id);
    console.log(`Time: ${team.name} | ID: ${team.id} | Jogos atuais: ${count || 0}`);

    if (!count || count < 20) {
        console.log("Histórico insuficiente. Vou forçar uma carga de 40 jogos...");
        // Como o massIngest.js já está configurado, vamos chamá-lo para esse time específico
        // Mas para ser mais rápido, vou simular o comando aqui
    }
}

checkAndRefill();
