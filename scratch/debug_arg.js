
import fs from 'fs';

const API_KEY = 'd5815b50acea81aba8152a13c20209c0';

async function searchBoca() {
    console.log("Buscando jogos recentes do Boca Juniors...");
    const fixResp = await fetch(`https://v3.football.api-sports.io/fixtures?team=451&season=2026`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());
    
    const matches = fixResp.response || [];
    // Filter matches around May 2026
    const recent = matches.filter(m => m.fixture.date.includes('2026-05-'));
    
    recent.forEach(m => {
        console.log(`[ID: ${m.fixture.id}] ${m.fixture.date} - ${m.teams.home.name} x ${m.teams.away.name} (${m.fixture.status.short})`);
    });
}

searchBoca();
