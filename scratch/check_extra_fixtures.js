import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

// Check the 6 "extra" fixtures that are in our DB but NOT in the API for today
const extraApiIds = [1520730, 1520736, 1520731, 1520733, 1520734, 1520737];

for (const apiId of extraApiIds) {
  const url = `https://v3.football.api-sports.io/fixtures?id=${apiId}`;
  const resp = await fetch(url, { headers });
  const data = await resp.json();
  const f = data.response?.[0];
  if (f) {
    console.log(`API ID ${apiId}: ${f.teams.home.name} vs ${f.teams.away.name}`);
    console.log(`  API date: ${f.fixture.date}`);
    console.log(`  Status: ${f.fixture.status.short} (${f.fixture.status.long})`);
    console.log(`  Round: ${f.league.round}`);
    console.log();
  }
  // Rate limit
  await new Promise(r => setTimeout(r, 1200));
}
