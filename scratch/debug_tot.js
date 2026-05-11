
import fs from 'fs';

const API_KEY = 'd5815b50acea81aba8152a13c20209c0';

async function checkTottenham() {
    console.log("Buscando histórico do Tottenham em Março de 2026...");
    const fixResp = await fetch(`https://v3.football.api-sports.io/fixtures?team=47&season=2026`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());
    
    const matches = fixResp.response || [];
    const marchMatches = matches.filter(m => m.fixture.date.includes('2026-03-'));
    
    marchMatches.forEach(m => {
        console.log(`[${m.fixture.date.split('T')[0]}] ${m.teams.home.name} ${m.goals.home} x ${m.goals.away} ${m.teams.away.name}`);
    });
}

checkTottenham();
