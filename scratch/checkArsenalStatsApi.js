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

async function checkStats(fixtureId) {
  const resp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, { headers: API_HEADERS });
  const json = await resp.json();
  
  console.log("Statistics for fixture:");
  console.log(JSON.stringify(json.response, null, 2));
}

checkStats(1540843);
