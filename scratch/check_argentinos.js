
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
  const resp = await fetch('https://v3.football.api-sports.io/fixtures?id=1544850', { 
    headers: { 
      'x-apisports-key': env.VITE_API_FOOTBALL_KEY, 
      'x-rapidapi-host': 'v3.football.api-sports.io' 
    } 
  });
  const data = await resp.json();
  console.log(JSON.stringify(data.response[0].fixture.status, null, 2));
  console.log('Goals:', data.response[0].goals);
}

check();
