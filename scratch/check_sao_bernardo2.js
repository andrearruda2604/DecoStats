import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://lzmxkgylqibgohtzvfhb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6bXhrZ3lscWliZ29odHp2ZmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc0NjIsImV4cCI6MjA5MjAwMzQ2Mn0.Jv4KasCa7zFiJ3UtH20XDKUyPFoJ6lyh1TRjdW4jtUg";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('fixtures')
    .select('id, date, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)')
    .gte('date', `2026-05-29T00:00:00-03:00`)
    .lte('date', `2026-05-29T23:59:59-03:00`)
    .order('date', { ascending: true })
    .limit(10);
  
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

run();
