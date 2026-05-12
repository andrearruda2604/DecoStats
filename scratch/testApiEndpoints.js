import fs from 'fs';

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

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY };

async function main() {
  // Test 1: half=true with the doc example fixture
  console.log('=== TEST 1: half=true (fixture 215662 from docs) ===\n');
  const r1 = await fetch('https://v3.football.api-sports.io/fixtures/statistics?fixture=215662&half=true', { headers });
  const d1 = await r1.json();
  console.log('results:', d1.results);
  console.log(JSON.stringify(d1.response, null, 2).substring(0, 4000));
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 2: type filter
  console.log('\n\n=== TEST 2: type=Total Shots (fixture 215662) ===\n');
  const r2 = await fetch('https://v3.football.api-sports.io/fixtures/statistics?fixture=215662&type=Total%20Shots', { headers });
  const d2 = await r2.json();
  console.log('results:', d2.results);
  console.log(JSON.stringify(d2.response, null, 2));
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 3: half=true with a RECENT fixture (our data - Tottenham x Leeds)
  console.log('\n\n=== TEST 3: half=true (fixture 1379327 - Tottenham x Leeds - recent) ===\n');
  const r3 = await fetch('https://v3.football.api-sports.io/fixtures/statistics?fixture=1379327&half=true', { headers });
  const d3 = await r3.json();
  console.log('results:', d3.results);
  // Show keys at team level
  for (const team of (d3.response || [])) {
    console.log(`\n  Team: ${team.team.name}`);
    console.log(`  Keys: ${Object.keys(team).join(', ')}`);
    if (team.statistics_1h) {
      console.log('  statistics_1h sample:');
      for (const s of team.statistics_1h.slice(0, 5)) {
        console.log(`    ${s.type}: ${s.value}`);
      }
    }
    if (team.statistics_2h) {
      console.log('  statistics_2h sample:');
      for (const s of team.statistics_2h.slice(0, 5)) {
        console.log(`    ${s.type}: ${s.value}`);
      }
    }
  }
}

main().catch(console.error);
