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

const API_KEY = env.VITE_API_FOOTBALL_KEY;
const headers = { 'x-apisports-key': API_KEY };

async function main() {
  // The half parameter may duplicate the response entries instead of adding a property
  // Let me check the FULL raw response with half=true
  const fid = 1379327; // Tottenham x Leeds
  
  const r = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fid}&half=true`, { headers });
  const d = await r.json();
  
  console.log('Full response:');
  console.log(JSON.stringify(d.response, null, 2).substring(0, 3000));
  
  console.log('\n\n--- Pages/paging ---');
  console.log('results:', d.results);
  console.log('paging:', JSON.stringify(d.paging));
}

main().catch(console.error);
