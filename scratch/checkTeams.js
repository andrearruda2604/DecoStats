import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: teams } = await supabase.from('teams').select('api_id, name').in('name', ['Napoli', 'Bologna']);
  console.log("Teams:", teams);
  
  if (teams.length === 2) {
    const { data: napoliHistory } = await supabase.from('teams_history').select('*').eq('team_id', teams.find(t => t.name === 'Napoli').api_id).order('match_date', { ascending: false });
    const { data: bolognaHistory } = await supabase.from('teams_history').select('*').eq('team_id', teams.find(t => t.name === 'Bologna').api_id).order('match_date', { ascending: false });
    
    console.log("Napoli Total Games:", napoliHistory.length);
    console.log("Napoli By League:");
    const napoliLeagues = {};
    for (let r of napoliHistory) { napoliLeagues[r.league_id] = (napoliLeagues[r.league_id] || 0) + 1; }
    console.log(napoliLeagues);
    
    console.log("\nBologna Total Games:", bolognaHistory.length);
    console.log("Bologna By League:");
    const bolognaLeagues = {};
    for (let r of bolognaHistory) { bolognaLeagues[r.league_id] = (bolognaLeagues[r.league_id] || 0) + 1; }
    console.log(bolognaLeagues);
    
    // Check missing seasons?
    console.log("\nNapoli By Season:");
    const nSeason = {};
    for (let r of napoliHistory) { nSeason[r.season] = (nSeason[r.season] || 0) + 1; }
    console.log(nSeason);

    console.log("\nBologna By Season:");
    const bSeason = {};
    for (let r of bolognaHistory) { bSeason[r.season] = (bSeason[r.season] || 0) + 1; }
    console.log(bSeason);
  }
}

run();
