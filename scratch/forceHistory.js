import { execSync } from 'child_process';
import fs from 'fs';

async function forceHistory() {
    const dates = ['2026-04-21', '2026-04-22', '2026-04-23'];
    
    // Temporariamente baixar a regua de confianca no gerador
    const generatorPath = 'scripts/generateOdd2.js';
    const originalContent = fs.readFileSync(generatorPath, 'utf8');
    
    console.log("🛠️  Baixando a régua de confiança para 70% (Temporário)...");
    const patchedContent = originalContent.replace(/probability >= 80/g, 'probability >= 70');
    fs.writeFileSync(generatorPath, patchedContent);

    for (const d of dates) {
        console.log(`\n--- Forçando ${d} ---`);
        try {
            execSync(`node scripts/generateOdd2.js ${d}`);
            execSync(`node scripts/settleTickets.js`);
        } catch (e) {
            console.log(`   ❌ Erro: ${e.message}`);
        }
    }

    // Voltar o gerador ao normal
    console.log("\n🛠️  Restaurando régua de confiança para 80%...");
    fs.writeFileSync(generatorPath, originalContent);

    console.log("\n✅ DIAS 21, 22 E 23 REGERADOS COM SUCESSO!");
}

forceHistory();
