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

async function debugLeague() {
    console.log("--- DEBUG LIGA 135 ---");
    
    // 1. Ver temporadas disponíveis para 135
    const resL = await fetch(`https://v3.football.api-sports.io/leagues?id=135`, { headers });
    const dataL = await resL.json();
    if (dataL.response && dataL.response.length > 0) {
        const detail = dataL.response[0];
        console.log(`Nome: ${detail.league.name} | País: ${detail.country.name}`);
        console.log(`Temporadas disponíveis: ${detail.seasons.map(s => s.year).join(', ')}`);
        
        // 2. Testar buscar times na última temporada disponível
        const lastSeason = detail.seasons[detail.seasons.length - 1].year;
        console.log(`\nTestando buscar times na temporada: ${lastSeason}...`);
        const resT = await fetch(`https://v3.football.api-sports.io/teams?league=135&season=${lastSeason}`, { headers });
        const dataT = await resT.json();
        console.log(`Times encontrados: ${dataT.response?.length || 0}`);
    } else {
        console.log("ERRO: Liga 135 não retornou detalhes na API.");
    }
}

debugLeague();
