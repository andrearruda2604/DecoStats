/**
 * MASTER DAILY SCRIPT
 * Coordinates all maintenance and generation tasks in the correct order.
 */

import { execSync } from 'child_process';

function runScript(name, args = '') {
    console.log(`\n\n==================================================`);
    console.log(`🚀 RUNNING: ${name} ${args}`);
    console.log(`==================================================\n`);
    try {
        execSync(`node scripts/${name} ${args}`, { stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ FAILED: ${name}`);
        // Continue with next script even if one fails
    }
}

async function main() {
    console.log("🌟 DECOSTATS DAILY ENGINE STARTING 🌟");

    // 1. Sync today's fixtures and results
    runScript('syncToday.js');

    // 2. Sync missing history statistics (crucial for accurate predictions)
    runScript('syncMissingStats.js');

    // 3. Evaluate yesterday's tickets
    // By default evaluateOdd2.js evaluates yesterday
    runScript('evaluateOdd2.js');

    // 4. Generate Today's Tickets
    runScript('generateOdd2.js');
    runScript('generateOdd3.js');

    console.log("\n\n🌟 DAILY ENGINE COMPLETED SUCCESSFULLY 🌟");
}

main().catch(console.error);
