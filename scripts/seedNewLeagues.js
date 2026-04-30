import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const newLeagues = [
  {
    api_id: 13,
    name: 'Copa Libertadores',
    country: 'South America',
    country_code: 'SA',
    logo_url: 'https://media.api-sports.io/football/leagues/13.png',
    flag_url: '',
    season: 2026,
    is_active: true,
  },
  {
    api_id: 11,
    name: 'Copa Sudamericana',
    country: 'South America',
    country_code: 'SA',
    logo_url: 'https://media.api-sports.io/football/leagues/11.png',
    flag_url: '',
    season: 2026,
    is_active: true,
  },
  {
    api_id: 3,
    name: 'Europa League',
    country: 'Europe',
    country_code: 'EU',
    logo_url: 'https://media.api-sports.io/football/leagues/3.png',
    flag_url: '',
    season: 2026,
    is_active: true,
  },
  {
    api_id: 848,
    name: 'Conference League',
    country: 'Europe',
    country_code: 'EU',
    logo_url: 'https://media.api-sports.io/football/leagues/848.png',
    flag_url: '',
    season: 2026,
    is_active: true,
  },
];

async function seedLeagues() {
  console.log('=== Inserindo novas ligas no Supabase ===\n');

  for (const league of newLeagues) {
    const { data, error } = await supabase
      .from('leagues')
      .upsert(league, { onConflict: 'api_id' })
      .select();

    if (error) {
      console.error(`✗ Erro ao inserir ${league.name}:`, error.message);
    } else {
      console.log(`✓ ${league.name} (api_id: ${league.api_id}) inserida/atualizada`);
    }
  }

  console.log('\n=== Concluído ===');
}

seedLeagues().catch(console.error);
