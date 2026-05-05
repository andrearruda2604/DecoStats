import fs from 'fs';
let env = {};
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

async function checkIds(dateStr) {
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
    headers: { 'x-apisports-key': API_KEY }
  });
  const json = await resp.json();
  const matches = json.response || [];
  
  const chelsea = matches.find(m => m.teams.home.name.includes('Chelsea') || m.teams.away.name.includes('Chelsea'));
  if (chelsea) {
    console.log(`Found Chelsea game: ${chelsea.teams.home.name} x ${chelsea.teams.away.name}`);
    console.log(`API ID: ${chelsea.fixture.id}`);
    console.log(`Status: ${chelsea.fixture.status.short}`);
    console.log(`Score: ${chelsea.goals.home}-${chelsea.goals.away}`);
  } else {
    console.log('Chelsea game not found in API response for this date.');
  }
}

checkIds('2026-05-04').catch(console.error);
