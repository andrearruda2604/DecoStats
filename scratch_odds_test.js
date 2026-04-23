import fs from 'fs';

const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/"/g, '').replace(/\r/g, '');
});

const fixtureId = 1391144;
const url = 'https://v3.football.api-sports.io/odds?fixture=' + fixtureId;

fetch(url, { headers: { 'x-apisports-key': env.VITE_API_FOOTBALL_KEY } })
  .then(r => r.json())
  .then(data => {
    const bookmakers = data.response[0]?.bookmakers || [];
    console.log('Bookmakers attached:', bookmakers.map(b => b.id + ' ' + b.name));
    if (bookmakers.length > 0) {
      console.log('Sample bets (Bookmaker 0):', JSON.stringify(bookmakers[0].bets.slice(0, 3), null, 2));
    }
  })
  .catch(console.error);
