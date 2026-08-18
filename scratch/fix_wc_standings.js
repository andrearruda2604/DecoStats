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

async function fix() {
  // Get World Cup league ID
  const { data: wcLeague } = await supabase.from('leagues').select('id').eq('api_id', 1).single();
  const leagueId = wcLeague.id;
  console.log('World Cup league DB id:', leagueId);

  // ─── 1. Remove "Group Stage" entries ─────────────────────────────
  console.log('\n=== 1. Removendo "Group Stage" ===');
  const { data: deleted, error: delErr } = await supabase
    .from('standings')
    .delete()
    .eq('league_id', leagueId)
    .eq('group', 'Group Stage')
    .select('team_name');

  if (delErr) {
    console.error('Erro ao deletar:', delErr.message);
  } else {
    console.log(`Removidos ${deleted.length} registros de "Group Stage"`);
  }

  // ─── 2. Update standings logos to use Supabase Storage ────────────
  console.log('\n=== 2. Atualizando logos nos standings ===');
  const { data: standings } = await supabase
    .from('standings')
    .select('id, team_api_id, team_logo')
    .eq('league_id', leagueId);

  // Get all teams with their migrated logos
  const teamApiIds = [...new Set(standings.map(s => s.team_api_id))];
  const { data: teams } = await supabase
    .from('teams')
    .select('api_id, logo_url')
    .in('api_id', teamApiIds);

  const teamLogoMap = Object.fromEntries(teams.map(t => [t.api_id, t.logo_url]));

  let updatedLogos = 0;
  for (const row of standings) {
    const migratedLogo = teamLogoMap[row.team_api_id];
    if (migratedLogo && migratedLogo !== row.team_logo) {
      const { error } = await supabase
        .from('standings')
        .update({ team_logo: migratedLogo })
        .eq('id', row.id);
      if (!error) updatedLogos++;
    }
  }
  console.log(`Atualizados ${updatedLogos} logos nos standings`);

  // ─── 3. Update World Cup league logo to FIFA official ────────────
  console.log('\n=== 3. Atualizando logo da Copa do Mundo ===');
  // Use the official FIFA World Cup 2026 logo
  const officialLogoUrl = 'https://upload.wikimedia.org/wikipedia/pt/b/bf/2026_FIFA_World_Cup_emblem.svg';
  
  const { error: logoErr } = await supabase
    .from('leagues')
    .update({ logo_url: officialLogoUrl })
    .eq('api_id', 1);

  if (logoErr) {
    console.error('Erro ao atualizar logo:', logoErr.message);
  } else {
    console.log('Logo da Copa do Mundo atualizado para o oficial FIFA');
  }

  // ─── 4. Verify ───────────────────────────────────────────────────
  console.log('\n=== Verificação final ===');
  const { data: finalStandings } = await supabase
    .from('standings')
    .select('group')
    .eq('league_id', leagueId);

  const groups = [...new Set(finalStandings.map(s => s.group))].sort();
  console.log('Grupos restantes:', groups);
  console.log('Total de rows:', finalStandings.length);

  const { data: leagueCheck } = await supabase.from('leagues').select('logo_url').eq('api_id', 1).single();
  console.log('Logo da liga:', leagueCheck.logo_url);
}

fix().catch(console.error);
