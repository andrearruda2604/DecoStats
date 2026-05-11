import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

// Load Env
let env = { ...process.env };
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!env[match[1].trim()]) env[match[1].trim()] = val;
    }
  });
} catch (_) {}

const tomorrow = process.argv[2] || new Date(Date.now() + 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000).toISOString().split('T')[0];

async function runPreview() {
    console.log(`\n🔍 GERANDO PREVIEW DE BILHETES PARA: ${tomorrow}\n`);

    console.log(`--- Executando Extração de Candidatos ---`);
    try {
        const candidatesOut = execSync(`node scratch/extractCandidates.js ${tomorrow}`, { encoding: 'utf8' });
        console.log(candidatesOut);
    } catch (e) {
        console.error("Erro ao extrair candidatos:", e.message);
    }

    console.log(`\n--- Proposta Bilhete ODD 2.0 ---`);
    try {
        // Para o preview, vamos apenas capturar o log do console sem salvar no banco?
        // Atualmente os scripts SALVAM no banco. 
        // Eu vou rodar com --preview (vou precisar modificar os scripts) ou apenas rodar e mostrar.
        // O usuário quer validar ANTES de gerar. Então eu NÃO devo salvar.
        // Vou modificar temporariamente os scripts para aceitarem --preview.
        const odd2Out = execSync(`node scripts/generateOdd2.js ${tomorrow} --preview`, { encoding: 'utf8' });
        console.log(odd2Out);
    } catch (e) {
        console.error("Erro ao gerar Odd 2.0:", e.message);
    }

    console.log(`\n--- Proposta Bilhete ODD 3.0 ---`);
    try {
        const odd3Out = execSync(`node scripts/generateOdd3.js ${tomorrow} --preview`, { encoding: 'utf8' });
        console.log(odd3Out);
    } catch (e) {
        console.error("Erro ao gerar Odd 3.0:", e.message);
    }
}

runPreview();
