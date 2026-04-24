import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' };

async function check() {
    console.log("--- LISTA COMPLETA LIGAS ITÁLIA ---");
    const res = await fetch(`https://v3.football.api-sports.io/leagues?country=Italy`, { headers });
    const data = await res.json();
    
    const results = data.response.map(l => ({
        ID: l.league.id,
        Nome: l.league.name,
        Temporada_Atual: l.seasons.find(s => s.current)?.year
    }));
    
    console.table(results);
}

check();
