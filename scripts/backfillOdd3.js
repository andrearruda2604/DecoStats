import { execSync } from 'child_process';

const DAYS_TO_BACKFILL = 10; // Vou tentar 10 dias

async function backfill() {
  const dates = [];
  for (let i = 1; i <= DAYS_TO_BACKFILL; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Ordenar do mais antigo para o mais recente
  dates.reverse();

  for (const date of dates) {
    console.log(`\n\n>>> PROCESSANDO DATA: ${date} <<<`);
    try {
      execSync(`node scripts/generateOdd3.js ${date}`, { stdio: 'inherit' });
      // Pequeno delay para não sobrecarregar
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Erro ao processar ${date}:`, err.message);
    }
  }
  
  console.log("\n\n=== BACKFILL CONCLUÍDO. APURANDO RESULTADOS... ===");
  try {
    execSync(`node scripts/settleTickets.js`, { stdio: 'inherit' });
  } catch (err) {
    console.error("Erro ao apurar resultados:", err.message);
  }
}

backfill().catch(console.error);
