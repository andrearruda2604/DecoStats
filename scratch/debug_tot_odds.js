
import fs from 'fs';

const API_KEY = 'd5815b50acea81aba8152a13c20209c0';

async function fetchOdds() {
    const fixture_id = 1379327;
    console.log("Fetching odds for Tottenham vs Leeds...");
    const r = await fetch(`https://v3.football.api-sports.io/odds?fixture=${fixture_id}&bookmaker=8`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(res => res.json());

    const odds = r.response[0]?.bookmakers[0]?.bets;
    if (!odds) {
        console.log("No odds found.");
        return;
    }

    const homeGoals = odds.find(b => b.id === 16); // 16 = Home Team Goals
    if (homeGoals) {
        console.log("Gols Casa:");
        homeGoals.values.forEach(v => console.log(`  ${v.value}: ${v.odd}`));
    }
}
fetchOdds();
