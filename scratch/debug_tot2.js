
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testTot() {
    const { data: homeHistory } = await supabase.from('teams_history')
        .select('*').eq('team_id', 47).eq('season', 2026).eq('league_id', 39).eq('is_home', true);
        
    let homeHits = 0;
    let homeValid = 0;
    const threshold = 2.5;

    for (const match of homeHistory) {
        let actualValue = match.goals_for || 0;
        let isValid = true;
        homeValid++;
        if (actualValue < threshold) {
            homeHits++;
        } else {
            console.log(`FALHOU: Em ${match.match_date}, Tot fez ${actualValue} gols. (Menos de 2.5)`);
        }
    }
    
    console.log(`Valid: ${homeValid}, Hits: ${homeHits}, Pct: ${(homeHits / homeValid) * 100}%`);
}
testTot();
