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

async function fixCorners() {
  const fid = 1520749; // Operario-PR x America Mineiro

  console.log('Atualizando cantos para o América Mineiro e Operário-PR...');

  // Update America Mineiro (team_id = 125)
  const { error: err1 } = await supabase
    .from('teams_history')
    .update({ corners: 6 })
    .eq('fixture_id', fid)
    .eq('team_id', 125);

  if (err1) console.error('Erro ao atualizar América:', err1);
  else console.log('América Mineiro atualizado para 6 escanteios.');

  // Update Operario-PR (team_id = 1223)
  const { error: err2 } = await supabase
    .from('teams_history')
    .update({ corners: 7 })
    .eq('fixture_id', fid)
    .eq('team_id', 1223);

  if (err2) console.error('Erro ao atualizar Operário:', err2);
  else console.log('Operário-PR atualizado para 7 escanteios.');
}

fixCorners().catch(console.error);
