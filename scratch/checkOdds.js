import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
});

const date = process.argv[2] || '2026-04-10';
const apiKey = env.VITE_API_FOOTBALL_KEY || env.API_FOOTBALL_KEY;

async function check() {
  const r = await fetch(`https://v3.football.api-sports.io/odds?date=${date}&bookmaker=8`, {
    headers: { 'x-apisports-key': apiKey }
  });
  const d = await r.json();
  console.log(`Date: ${date} | Results: ${d.results}`);
}
check();
