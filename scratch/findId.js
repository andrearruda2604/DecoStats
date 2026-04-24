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

async function findCremonese() {
    console.log("🔍 Investigando Cremonese no banco de dados...");
    
    // Buscar o jogo do Napoli x Cremonese que você viu
    const { data: fixtures } = await supabase
        .from('fixtures')
        .select(`
            league_id, 
            home:home_team_id(name), 
            away:away_team_id(name)
        `)
        .or('home_team_id.eq.520,away_team_id.eq.520')
        .limit(1);

    if (fixtures && fixtures.length > 0) {
        console.log(`✅ Cremonese encontrada!`);
        console.log(`📍 Liga ID no seu banco: ${fixtures[0].league_id}`);
        console.log(`⚽ Jogo Exemplo: ${fixtures[0].home.name} x ${fixtures[0].away.name}`);
    } else {
        console.log("❌ Nenhuma partida da Cremonese encontrada no banco 'fixtures'.");
    }
}

findCremonese();
