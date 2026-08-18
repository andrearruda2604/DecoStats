import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function check() {
  // 1. Check standings group values for World Cup
  const { data: wcLeague } = await supabase.from('leagues').select('id').eq('api_id', 1).single();
  console.log('World Cup league DB id:', wcLeague?.id);

  const { data: standings } = await supabase.from('standings')
    .select('group, rank, team_name, team_logo')
    .eq('league_id', wcLeague.id)
    .order('group')
    .order('rank');

  const groups = [...new Set(standings.map(s => s.group))];
  console.log('\nGrupos distintos:', groups);
  console.log('\nExemplo de rows (primeiro grupo):');
  const first = standings.filter(s => s.group === groups[0]).slice(0, 3);
  first.forEach(r => console.log(`  ${r.rank}. ${r.team_name} | group: "${r.group}" | logo: ${r.team_logo}`));

  // 2. Check league logo
  const { data: leagueRow } = await supabase.from('leagues').select('logo_url').eq('api_id', 1).single();
  console.log('\nLogo da liga World Cup:', leagueRow?.logo_url);

  // 3. Check if team logos are accessible (check a few)
  const sampleLogos = standings.slice(0, 3).map(s => s.team_logo);
  console.log('\nExemplo de logos de times:', sampleLogos);

  // 4. Check teams table for World Cup teams logos
  const { data: wcTeams } = await supabase.from('teams')
    .select('api_id, name, logo_url')
    .eq('league_id', wcLeague.id)
    .limit(5);
  console.log('\nTimes da Copa (tabela teams):');
  wcTeams.forEach(t => console.log(`  ${t.name}: ${t.logo_url}`));
}

check().catch(console.error);
