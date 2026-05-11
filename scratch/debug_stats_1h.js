
import fs from 'fs';

const API_KEY = 'd5815b50acea81aba8152a13c20209c0';
const fixtureId = 1388597; // Dortmund x Frankfurt

async function testHalfTime() {
    console.log("Fetching statistics with half=true...");
    const s1 = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}&half=true`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());

    if (s1.response && s1.response.length > 0) {
        console.log("1H Stats Dortmund x Frankfurt:");
        console.log(JSON.stringify(s1.response, null, 2));
    } else {
        console.log("Response empty or missing.");
        console.log(s1);
    }
}

testHalfTime();
