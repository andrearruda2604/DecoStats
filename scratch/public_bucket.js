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

async function checkBucket() {
  const { data, error } = await supabase.storage.updateBucket('logos', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml']
  });
  
  if (error) {
    console.error('Error updating bucket:', error.message);
  } else {
    console.log('Successfully ensured logos bucket is public.');
  }
}

checkBucket();
