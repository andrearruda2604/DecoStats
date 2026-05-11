
import fs from 'fs';

const API_KEY = '85e78749e77b61f22495914619d70104';

async function fetchRawData(fixtureId, name) {
    console.log(`\n==============================================`);
    console.log(`Buscando dados RAW para: ${name} (ID: ${fixtureId})`);
    
    // 1. Fetch Fixture details
    const fixResp = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());
    
    if (!fixResp.response || fixResp.response.length === 0) {
        console.log(`Erro: Partida não encontrada na API.`);
        return;
    }
    const match = fixResp.response[0];
    console.log(`Status: ${match.fixture.status.short} | Placar FT: ${match.goals.home}-${match.goals.away} | Placar HT: ${match.score.halftime.home}-${match.score.halftime.away}`);

    // 2. Fetch Events (To count HT cards manually)
    const evResp = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());
    
    const events = evResp.response || [];
    const htCards = events.filter(e => e.type === 'Card' && e.time.elapsed <= 45);
    const ftCards = events.filter(e => e.type === 'Card');
    
    console.log(`\n-- EVENTOS (Cartões) --`);
    console.log(`Total de Cartões no Jogo: ${ftCards.length}`);
    console.log(`Cartões no 1º Tempo (<= 45m): ${htCards.length}`);
    htCards.forEach(c => console.log(`  [${c.time.elapsed}'] ${c.team.name}: ${c.detail} (${c.player.name})`));

    // 3. Fetch Full Statistics
    const statResp = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());
    
    console.log(`\n-- ESTATÍSTICAS FT DA API --`);
    const stats = statResp.response || [];
    stats.forEach(team => {
        console.log(`Time: ${team.team.name}`);
        const corners = team.statistics.find(s => s.type === 'Corner Kicks')?.value || 0;
        const shotsOnGoal = team.statistics.find(s => s.type === 'Shots on Goal')?.value || 0;
        const yellow = team.statistics.find(s => s.type === 'Yellow Cards')?.value || 0;
        const red = team.statistics.find(s => s.type === 'Red Cards')?.value || 0;
        const saves = team.statistics.find(s => s.type === 'Goalkeeper Saves')?.value || 0;
        console.log(`  Escanteios: ${corners} | Chutes no Gol: ${shotsOnGoal} | Cartões: ${Number(yellow) + Number(red)} | Defesas: ${saves}`);
    });
}

async function run() {
    await fetchRawData(1391162, "Elche x Alaves (09/05)");
    // I will fetch 08/05 tickets next.
}

run();
