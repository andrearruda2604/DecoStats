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

async function force() {
    console.log("🧹 Deletando bilhete de hoje (2026-04-24)...");
    const { error } = await supabase.from('odd_tickets').delete().eq('date', '2026-04-24');
    
    if (error) {
        console.error("❌ Erro ao deletar:", error.message);
    } else {
        console.log("✅ Bilhete deletado. Rodando gerador...");
        try {
            const output = execSync('node scripts/generateOdd2.js 2026-04-24').toString();
            console.log(output);
        } catch(e) {
            console.error("❌ Erro ao rodar gerador:", e.message);
        }
    }
}

force();
