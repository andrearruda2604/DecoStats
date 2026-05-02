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

async function run() {
  const r = await fetch('https://v3.football.api-sports.io/odds?date=2026-05-02&bookmaker=8', { headers: { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY } });
  const d = await r.json();
  const res = d.response || [];
  if (res.length > 0) {
    console.log('Found odds for fixture:', res[0].fixture.id);
    const bets = res[0].bookmakers[0].bets;
    console.log('Bets IDs:', bets.map(b => b.id).join(', '));
  } else {
    console.log('No odds for 2026-05-02');
  }
}
run();
