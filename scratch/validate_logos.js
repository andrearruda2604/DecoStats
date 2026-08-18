import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkLogos() {
  console.log('=== LOGO VALIDATION CHECK ===\n');

  // 1. Check Teams
  const { data: teams } = await supabase.from('teams').select('id, name, logo_url');
  const teamsMissing = teams.filter(t => !t.logo_url);
  const teamsApiSports = teams.filter(t => t.logo_url && t.logo_url.includes('api-sports.io'));
  
  console.log(`[TEAMS] Total teams: ${teams.length}`);
  console.log(`[TEAMS] Missing logos: ${teamsMissing.length}`);
  console.log(`[TEAMS] Logos on api-sports: ${teamsApiSports.length}`);
  if (teamsApiSports.length > 0) {
    console.log('  ⚠️ Teams still on api-sports:', teamsApiSports.map(t => t.name).join(', '));
  }

  // 2. Check Leagues
  const { data: leagues } = await supabase.from('leagues').select('id, name, logo_url');
  const leaguesMissing = leagues.filter(l => !l.logo_url);
  const leaguesApiSports = leagues.filter(l => l.logo_url && l.logo_url.includes('api-sports.io'));

  console.log(`\n[LEAGUES] Total leagues: ${leagues.length}`);
  console.log(`[LEAGUES] Missing logos: ${leaguesMissing.length}`);
  console.log(`[LEAGUES] Logos on api-sports: ${leaguesApiSports.length}`);
  if (leaguesApiSports.length > 0) {
    console.log('  ⚠️ Leagues still on api-sports:', leaguesApiSports.map(l => l.name).join(', '));
  }

  // 3. Check today's tickets
  const { data: tickets } = await supabase.from('odd_tickets').select('mode, date, ticket_data').eq('date', '2026-06-14');
  console.log(`\n[TICKETS] Validating today's generated tickets (2026-06-14): ${tickets.length} tickets`);
  
  for (const t of tickets) {
    let apiSportsCount = 0;
    
    // For Odd 2.0 and 3.0
    if (t.ticket_data?.entries) {
      for (const e of t.ticket_data.entries) {
        if (e.homeLogo && e.homeLogo.includes('api-sports')) apiSportsCount++;
        if (e.awayLogo && e.awayLogo.includes('api-sports')) apiSportsCount++;
        if (e.league_logo_url && e.league_logo_url.includes('api-sports')) apiSportsCount++;
      }
    }
    
    // For Opportunities
    if (t.ticket_data?.opportunities) {
      for (const o of t.ticket_data.opportunities) {
        if (o.homeLogo && o.homeLogo.includes('api-sports')) apiSportsCount++;
        if (o.awayLogo && o.awayLogo.includes('api-sports')) apiSportsCount++;
        if (o.leagueLogo && o.leagueLogo.includes('api-sports')) apiSportsCount++;
      }
    }
    
    console.log(`  - Ticket [${t.mode}]: ${apiSportsCount} invalid logos found.`);
  }

  // 4. Check bucket public status
  const { data: bucket } = await supabase.storage.getBucket('logos');
  console.log(`\n[STORAGE] 'logos' bucket public status: ${bucket ? bucket.public : 'UNKNOWN (Error getting bucket)'}`);
}

checkLogos().catch(console.error);
