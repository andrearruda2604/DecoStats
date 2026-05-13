
import fs from 'fs';

const env = {};
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

async function check() {
  const resp = await fetch('https://v3.football.api-sports.io/fixtures/statistics?fixture=1544850&half=true', { 
    headers: { 
      'x-apisports-key': env.VITE_API_FOOTBALL_KEY, 
      'x-rapidapi-host': 'v3.football.api-sports.io' 
    } 
  });
  const data = await resp.json();
  data.response.forEach(teamStats => {
    console.log(`Team: ${teamStats.team.name}`);
    console.log(`  1H Corners:`, teamStats.statistics_1h.find(s => s.type === 'Corner Kicks').value);
    console.log(`  2H Corners:`, teamStats.statistics_2h.find(s => s.type === 'Corner Kicks').value);
    console.log(`  Total Corners:`, teamStats.statistics.find(s => s.type === 'Corner Kicks').value);
  });
}

check();
