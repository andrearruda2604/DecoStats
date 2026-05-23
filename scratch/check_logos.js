import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=\"(.*?)\"/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const { data: leagues } = await supabase.from('leagues').select('id, name, logo_url').in('id', [140, 71, 135]);
  console.log('Leagues:', leagues);
  
  const { data: teams } = await supabase.from('teams').select('id, name, logo_url').in('name', ['Lazio', 'Inter', 'Bologna', 'Celta Vigo', 'Novorizontino', 'Ceara']);
  console.log('Teams:', teams);
}
check();
