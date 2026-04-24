import { execSync } from 'child_process';

async function rebuild() {
    const dates = ['2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24'];
    
    console.log("🛠️  INICIANDO RECONSTRUÇÃO RETROATIVA...");

    for (const d of dates) {
        console.log(`\n--- Processando ${d} ---`);
        try {
            console.log(`   - Gerando Sugestão...`);
            execSync(`node scripts/generateOdd2.js ${d}`);
            
            console.log(`   - Apurando Green/Red...`);
            execSync(`node scripts/settleTickets.js`);
        } catch (e) {
            console.log(`   ❌ Erro no dia ${d}: ${e.message}`);
        }
    }

    console.log("\n✅ HISTÓRICO RECONSTRUÍDO COM SUCESSO!");
}

rebuild();
