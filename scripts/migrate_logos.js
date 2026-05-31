import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const supabaseUrl = urlMatch[1];
const supabase = createClient(supabaseUrl, keyMatch[1]);

async function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // If it's a redirect, we could follow it, but for media.api-sports it's usually direct
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          if (res2.statusCode !== 200) return reject(new Error(`Redirect failed ${res2.statusCode}`));
          const data = [];
          res2.on('data', chunk => data.push(chunk));
          res2.on('end', () => resolve(Buffer.concat(data)));
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

async function migrateLogos() {
  console.log('Fetching teams to migrate...');
  const { data: teams } = await supabase
    .from('teams')
    .select('id, logo_url')
    .like('logo_url', '%api-sports%');
    
  console.log(`Found ${teams?.length || 0} teams to migrate.`);

  // Do sequentially to avoid being blocked
  for (const t of (teams || [])) {
    try {
      console.log(`Downloading team ${t.id} from ${t.logo_url}...`);
      const buffer = await downloadImageBuffer(t.logo_url);
      const filePath = `teams/${t.id}.png`;
      
      const { error: uploadErr } = await supabase.storage.from('logos').upload(filePath, buffer, { contentType: 'image/png', upsert: true });
      if (uploadErr) { console.error('Upload error:', uploadErr); continue; }
      
      const newUrl = `${supabaseUrl}/storage/v1/object/public/logos/${filePath}`;
      await supabase.from('teams').update({ logo_url: newUrl }).eq('id', t.id);
      console.log(`Migrated team ${t.id} -> ${newUrl}`);
    } catch (e) {
      console.error(`Error on team ${t.id}:`, e.message);
    }
  }

  console.log('Migration complete!');
}

migrateLogos().catch(console.error);
