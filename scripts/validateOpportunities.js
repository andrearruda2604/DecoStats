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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function validate() {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  let targetDate = process.argv[2];
  if (!targetDate || targetDate === '--force') {
    targetDate = brt.toISOString().split('T')[0];
  }

  console.log(`\n=== Validando geração de Oportunidades para ${targetDate} ===`);

  const { data, error } = await supabase.from('odd_tickets')
    .select('date, matches_count')
    .eq('date', targetDate)
    .eq('mode', 'opp')
    .maybeSingle();

  if (error) {
    console.error('❌ ERRO ao validar oportunidades:', error.message);
    process.exit(1);
  }

  if (!data) {
    console.error(`⚠️ ALERTA CRÍTICO: Oportunidades NÃO foram geradas para a data ${targetDate}!`);
    console.error(`   Isso pode ocorrer por falta de jogos ativos, indisponibilidade da API, ou ausência de odds na casa de aposta.`);
    // O código de saída 1 faria o runScript alertar falha, mas queremos apenas alertar sem quebrar processos futuros
    // Se desejar que o Github Actions falhe e envie um alerta, pode-se usar process.exit(1)
  } else {
    console.log(`✅ SUCESSO: Oportunidades geradas e salvas no banco para ${targetDate}!`);
    console.log(`   Jogos com oportunidades: ${data.matches_count}`);
  }
}

validate().catch(console.error);
