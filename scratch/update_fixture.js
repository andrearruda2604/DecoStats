import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://lzmxkgylqibgohtzvfhb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6bXhrZ3lscWliZ29odHp2ZmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc0NjIsImV4cCI6MjA5MjAwMzQ2Mn0.Jv4KasCa7zFiJ3UtH20XDKUyPFoJ6lyh1TRjdW4jtUg";
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('fixtures')
    .update({ date: '2026-05-26T21:30:00+00:00' }) // Move to May 26th
    .eq('id', 2658);
  
  if (error) console.error(error);
  else console.log('Successfully updated fixture 2658 to a different date.');
}

run();
