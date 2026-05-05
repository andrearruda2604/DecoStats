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

async function checkSaves(fixtureId) {
  const resp = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fixtureId}&bookmaker=8&bet=267`, { headers: API_HEADERS });
  const json = await resp.json();
  const values = json.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values || [];
  
  console.log("Goalkeeper Saves Values:");
  values.forEach(v => console.log(`${v.value}: ${v.odd}`));
}

checkSaves(1540843);
