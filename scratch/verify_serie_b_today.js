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

// Check Serie B (league 72) fixtures for today from the API directly
const today = '2026-06-20';
const url = `https://v3.football.api-sports.io/fixtures?league=72&season=2026&date=${today}&timezone=America/Sao_Paulo`;

console.log(`Checking API: ${url}\n`);

const resp = await fetch(url, { headers });
const data = await resp.json();

console.log(`API returned ${data.response?.length || 0} fixtures for Serie B on ${today}:\n`);

for (const f of (data.response || [])) {
  const status = f.fixture.status.short;
  const home = f.teams.home.name;
  const away = f.teams.away.name;
  const date = f.fixture.date;
  const round = f.league.round;
  console.log(`  [${status}] ${home} vs ${away} - ${date} (${round})`);
}

// Also check remaining API calls
console.log(`\nAPI errors: ${JSON.stringify(data.errors)}`);
console.log(`Results: ${data.results}`);
