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

const API_HEADERS = { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY };

async function checkMarkets(fixtureId) {
  const resp = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}`, { headers: API_HEADERS });
  const json = await resp.json();
  const bookmakers = json.response?.[0]?.bookmakers || [];
  const bet365 = bookmakers.find(b => b.id === 8);
  
  if (!bet365) {
    console.log("Bet365 not found for this fixture");
    return;
  }

  bet365.bets.forEach(bet => {
    console.log(`ID: ${bet.id} | Name: ${bet.name}`);
    // bet.values.forEach(v => console.log(`  - ${v.value}: ${v.odd}`));
  });
}

checkMarkets(1540843);
