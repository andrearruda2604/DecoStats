import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

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

async function masterFix() {
    const dates = ['2026-04-23', '2026-04-24'];
    
    for (const d of dates) {
        console.log(`🧹 Limpando dia ${d}...`);
        await supabase.from('odd_tickets').delete().eq('date', d);
        
        console.log(`🚀 Gerando novo bilhete para ${d}...`);
        try {
            execSync(`node scripts/generateOdd2.js ${d}`);
        } catch (e) {
            console.log(`Erro ao gerar ${d}: ${e.message}`);
        }
    }

    console.log("\n✅ DIAS 23 E 24 LIMPOS E REGENERADOS COM DADOS REAIS.");
}

masterFix();
