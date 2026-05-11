
import fs from 'fs';

const API_KEY = 'd5815b50acea81aba8152a13c20209c0';

async function verifyPending() {
    console.log("--- BOCA JUNIORS x HURACAN (Novo ID: 1544177) ---");
    let bResp = await fetch(`https://v3.football.api-sports.io/fixtures?id=1544177`, { headers: { 'x-apisports-key': API_KEY } }).then(r => r.json());
    let bMatch = bResp.response[0];
    console.log(`Placar FT: Boca ${bMatch.goals.home} - ${bMatch.goals.away} Huracan`);
    
    console.log("\n--- Buscando novo ID para Belgrano x Talleres ---");
    let tResp = await fetch(`https://v3.football.api-sports.io/fixtures?team=456&season=2026`, { headers: { 'x-apisports-key': API_KEY } }).then(r => r.json());
    let tMatch = tResp.response.find(m => m.fixture.date.includes('2026-05-09') || m.fixture.date.includes('2026-05-10') || m.fixture.date.includes('2026-05-11'));
    
    if (tMatch) {
        console.log(`Achou: ${tMatch.teams.home.name} x ${tMatch.teams.away.name} (Novo ID: ${tMatch.fixture.id})`);
        console.log(`Placar FT: ${tMatch.goals.home} - ${tMatch.goals.away}`);
    } else {
        console.log("Não achou o jogo do Talleres.");
    }
}

verifyPending();
