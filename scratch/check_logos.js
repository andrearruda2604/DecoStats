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

// Get ALL tickets with entries
const { data: tickets } = await supabase
  .from('odd_tickets')
  .select('date, mode, matches_count, ticket_data')
  .gt('matches_count', 0)
  .order('date', { ascending: false })
  .limit(10);

console.log(`Found ${tickets?.length || 0} non-empty tickets:`);
for (const t of (tickets || [])) {
  const entries = t.ticket_data?.entries || [];
  let apiSportsCount = 0;
  for (const e of entries) {
    if (e.homeLogo?.includes('api-sports')) apiSportsCount++;
    if (e.awayLogo?.includes('api-sports')) apiSportsCount++;
    if (e.league_logo_url?.includes('api-sports')) apiSportsCount++;
  }
  console.log(`  ${t.date} (${t.mode}) - ${t.matches_count} matches, ${apiSportsCount} api-sports logos`);
}

// Check opportunities table too
const { data: opps } = await supabase
  .from('opportunities')
  .select('id')
  .limit(1);
console.log(`\nOpportunities table exists: ${opps !== null}`);
if (opps?.length > 0) {
  console.log('  Has data');
}
