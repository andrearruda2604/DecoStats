import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const API_KEY = env['VITE_API_FOOTBALL_KEY'];
const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function getStandings(leagueId, season) {
    const url = `https://v3.football.api-sports.io/standings?league=${leagueId}&season=${season}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (data.errors && Object.keys(data.errors).length > 0) return null;
    return data.response[0]?.league?.standings[0] || [];
}

async function analyzeGames() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const dateString = date.toISOString().split('T')[0];
    
    // Principais ligas europeias
    const targetLeagues = [140, 135]; // La Liga, Serie A
    const url = `https://v3.football.api-sports.io/fixtures?date=${dateString}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    const games = data.response.filter(f => targetLeagues.includes(f.league.id));

    const standingsCache = {};

    for (const g of games) {
        const leagueId = g.league.id;
        const season = g.league.season;
        
        if (!standingsCache[leagueId]) {
            standingsCache[leagueId] = await getStandings(leagueId, season);
        }
        
        const standings = standingsCache[leagueId];
        if (!standings) continue;

        const homeTeam = standings.find(t => t.team.id === g.teams.home.id);
        const awayTeam = standings.find(t => t.team.id === g.teams.away.id);

        if (homeTeam && awayTeam) {
            console.log(`\n[${g.league.name}] ${g.teams.home.name} (Pos: ${homeTeam.rank}, Pts: ${homeTeam.points}) vs ${g.teams.away.name} (Pos: ${awayTeam.rank}, Pts: ${awayTeam.points})`);
            
            // Relegation is usually rank >= 18. Europe is usually rank <= 7.
            // So 8 to 17 is the "dead" zone.
            const isHomeDead = homeTeam.rank > 7 && homeTeam.rank < 18;
            const isAwayDead = awayTeam.rank > 7 && awayTeam.rank < 18;

            if (isHomeDead && isAwayDead) {
                console.log("   -> 🔥 POTENCIAL 'AMISTOSO' (Ambos os times no meio da tabela, sem briga por título, Europa ou rebaixamento)");
            } else {
                console.log("   -> Jogo com disputa (Times brigando por Europa, Título ou Rebaixamento)");
            }
        }
    }
}

analyzeGames();
