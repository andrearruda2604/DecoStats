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
    const targetDate = process.argv[2] || '';
    console.log(`🌟 DECOSTATS DAILY ENGINE STARTING ${targetDate ? 'FOR ' + targetDate : ''} 🌟`);

    // 1. Sync today's fixtures and results
    runScript('syncToday.js', targetDate);

    // 1.5 Migrate any new logos fetched today to Supabase Storage
    runScript('migrate_logos.js');

    // 2. Sync missing history statistics (crucial for accurate predictions)
    runScript('syncMissingStats.js');

    // 3. Evaluate yesterday's tickets
    // By default evaluateOdd2.js evaluates yesterday
    runScript('evaluateOdd2.js');

    // 4. Generate Today's Tickets
    runScript('generateOdd2.js', targetDate);
    runScript('generateOdd3.js', targetDate);
    runScript('generateOpportunities.js', targetDate);

    // 4.5 Validate if opportunities were generated
    runScript('validateOpportunities.js', targetDate);

    // 5. Sync league standings
    runScript('syncStandings.js');

    console.log("\n\n🌟 DAILY ENGINE COMPLETED SUCCESSFULLY 🌟");
}

main().catch(console.error);
