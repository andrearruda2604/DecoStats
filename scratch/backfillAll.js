import { execSync } from 'child_process';

const startDate = new Date('2026-04-21');
const endDate = new Date();

async function run() {
  let current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    console.log(`\n\n========================================`);
    console.log(`     PROCESSING DATE: ${dateStr}`);
    console.log(`========================================`);

    try {
      console.log(`\n--- Running Odd 2.0 Generation ---`);
      execSync(`node scripts/generateOdd2.js ${dateStr}`, { stdio: 'inherit' });

      console.log(`\n--- Running Odd 3.0 Generation ---`);
      execSync(`node scripts/generateOdd3.js ${dateStr}`, { stdio: 'inherit' });

      console.log(`\n--- Running Evaluation ---`);
      execSync(`node scripts/evaluateOdd2.js ${dateStr}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Error processing ${dateStr}:`, e.message);
    }

    current.setDate(current.getDate() + 1);
  }
}

run();
