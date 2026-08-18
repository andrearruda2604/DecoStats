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

const { data: leagues } = await supabase.from('leagues').select('id, api_id, name, is_active').eq('is_active', true);
console.log('Active leagues (id vs api_id):');
for (const l of (leagues || [])) {
  const match = l.id === l.api_id ? '✅ same' : '⚠️ DIFFERENT';
  console.log(`  ${match} | id=${l.id}, api_id=${l.api_id} | ${l.name}`);
}

// Also check what league_id values exist in teams_history
const { data: histLeagues } = await supabase.from('teams_history')
  .select('league_id')
  .limit(1000);

const uniqueLeagueIds = [...new Set((histLeagues || []).map(h => h.league_id))];
console.log('\nLeague IDs in teams_history:', uniqueLeagueIds.sort((a,b) => a-b).join(', '));
