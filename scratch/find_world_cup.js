import fs from 'fs';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const API_KEY = process.env.VITE_API_FOOTBALL_KEY || env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

async function searchLeague() {
  const r = await fetch('https://v3.football.api-sports.io/leagues?search=World', { headers });
  const data = await r.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
      console.log('Errors:', data.errors);
      return;
  }
  const leagues = data.response.map(l => ({ id: l.league.id, name: l.league.name, country: l.country.name }));
  console.log(leagues);
}

searchLeague();
