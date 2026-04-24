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
const headers = { 
  'x-apisports-key': API_KEY, 
  'x-rapidapi-host': 'v3.football.api-sports.io' 
};

async function debugCremonese() {
    console.log("--- TESTE DE ENTRADA API: CREMONESE (520) ---");
    
    // Teste 1: Buscar últimos 5 jogos
    console.log("\nTeste 1: /fixtures?team=520&last=5");
    try {
        const res1 = await fetch(`https://v3.football.api-sports.io/fixtures?team=520&last=5`, { headers });
        const data1 = await res1.json();
        console.log("Status:", data1.results, "jogos encontrados.");
        if (data1.errors && Object.keys(data1.errors).length > 0) console.log("Erros API:", data1.errors);
        if (data1.response && data1.response.length > 0) {
            console.log("Primeiro jogo encontrado:", data1.response[0].fixture.date, "|", data1.response[0].teams.home.name, "x", data1.response[0].teams.away.name);
        }
    } catch (e) {
        console.log("Erro na requisição 1:", e.message);
    }

    // Teste 2: Buscar temporada 2025
    console.log("\nTeste 2: /fixtures?team=520&season=2025");
    try {
        const res2 = await fetch(`https://v3.football.api-sports.io/fixtures?team=520&season=2025`, { headers });
        const data2 = await res2.json();
        console.log("Status:", data2.results, "jogos encontrados.");
        if (data2.response && data2.response.length > 0) {
            console.log("Primeiro jogo encontrado (2025):", data2.response[0].fixture.date);
        }
    } catch (e) {
        console.log("Erro na requisição 2:", e.message);
    }
}

debugCremonese();
