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

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];
const API_KEY = env['API_FOOTBALL_KEY'] || env['VITE_API_FOOTBALL_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const headers = {
  'x-apisports-key': API_KEY,
  'x-rapidapi-host': 'v3.football.api-sports.io'
};

async function fetchWithRetry(url) {
  let retries = 3;
  while(retries > 0) {
    try {
      const resp = await fetch(url, { headers });
      const data = await resp.json();
      if(data.errors && Object.keys(data.errors).length > 0) {
        console.error("API Error:", data.errors);
        throw new Error(JSON.stringify(data.errors));
      }
      return data;
    } catch(err) {
      console.warn("Fetch failed, retrying...", url);
      await new Promise(r => setTimeout(r, 2000));
      retries--;
      if(retries === 0) throw err;
    }
  }
}

async function backfill() {
  console.log('--- BACKFILL: Adding HT/2H stats to existing records ---');
  
  // Get all records that don't have stats_ft populated yet
  const { data: records, error } = await supabase
    .from('teams_history')
    .select('id, fixture_id, team_id')
    .is('stats_ft', null)
    .order('id', { ascending: true })
    .limit(200); // Process in batches to respect API limits
    
  if (error) { console.error('Error fetching records:', error); return; }
  if (!records || records.length === 0) { console.log('No records need backfill!'); return; }
  
  console.log(`Found ${records.length} records to backfill.`);
  
  // Group by fixture_id to avoid duplicate API calls
  const fixtureMap = new Map();
  records.forEach(r => {
    if (!fixtureMap.has(r.fixture_id)) fixtureMap.set(r.fixture_id, []);
    fixtureMap.get(r.fixture_id).push(r);
  });
  
  console.log(`Unique fixtures to fetch: ${fixtureMap.size}`);
  
  let processed = 0;
  for (const [fixtureId, teamRecords] of fixtureMap) {
    processed++;
    console.log(`[${processed}/${fixtureMap.size}] Fetching fixture ${fixtureId}...`);
    
    try {
      const statsRes = await fetchWithRetry(
        `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}&half=true`
      );
      await new Promise(r => setTimeout(r, 1200)); // Rate limiting
      
      const statsList = statsRes.response || [];
      
      for (const rec of teamRecords) {
        const myStats = statsList.find(ts => ts.team.id === rec.team_id);
        if (!myStats) { console.log(`  No stats found for team ${rec.team_id}`); continue; }
        
        const { error: updateErr } = await supabase
          .from('teams_history')
          .update({
            stats_ft: myStats.statistics || [],
            stats_1h: myStats.statistics_1h || [],
            stats_2h: myStats.statistics_2h || []
          })
          .eq('id', rec.id);
          
        if (updateErr) console.error(`  Error updating record ${rec.id}:`, updateErr);
        else console.log(`  ✓ Updated team ${rec.team_id} record ${rec.id}`);
      }
    } catch (err) {
      console.error(`  Failed fixture ${fixtureId}:`, err.message);
    }
  }
  
  console.log('--- BACKFILL COMPLETE ---');
}

backfill().catch(console.error);
