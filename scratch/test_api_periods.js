
import fs from 'fs';

const API_KEY = '85e78749e77b61f22495914619d70104';
const fixtureId = 1544182; 

async function testPeriods() {
    const total = await fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, {
        headers: { 'x-apisports-key': API_KEY }
    }).then(r => r.json());

    console.log("Total Stats Response Sample (First Team):");
    if (total.response && total.response[0]) {
        console.log(JSON.stringify(total.response[0].statistics.slice(0, 5), null, 2));
        
        const corners = total.response[0].statistics.find(s => s.type === 'Corner Kicks');
        console.log(`\nCorners found in total: ${corners?.value}`);
    } else {
        console.log("No stats found in response.");
    }
}

testPeriods();
