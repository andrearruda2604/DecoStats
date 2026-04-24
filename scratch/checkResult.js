import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("🔍 Buscando QUALQUER jogo de Brighton ou Chelsea no banco...");
    
    // Buscar últimos 10 jogos do Brighton (ID 51) ou Chelsea (ID 49)
    const { data: matches } = await supabase
        .from('fixtures')
        .select('*')
        .or('home_team_id.eq.51,away_team_id.eq.51,home_team_id.eq.49,away_team_id.eq.49')
        .order('event_date', { ascending: false })
        .limit(10);

    if (matches) {
        console.table(matches.map(m => ({
            Data: m.event_date,
            Home: m.home_team_id,
            Away: m.away_team_id,
            Score: `${m.goals_home}x${m.goals_away}`,
            HT: m.score?.halftime?.home + 'x' + m.score?.halftime?.away
        })));
    }
}

check();
