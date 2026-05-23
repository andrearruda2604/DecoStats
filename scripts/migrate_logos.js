import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import https from 'https';
import path from 'path';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=\"(.*?)\"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=\"(.*?)\"/);
const supabaseUrl = urlMatch[1];
const supabase = createClient(supabaseUrl, keyMatch[1]);

async function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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
  console.log('Fetching leagues to migrate...');
  const { data: leagues } = await supabase
    .from('leagues')
    .select('id, logo_url')
    .like('logo_url', 'https://media.api-sports.io%');
    
  console.log(`Found ${leagues?.length || 0} leagues to migrate.`);

  for (const lg of (leagues || [])) {
    try {
      console.log(`Downloading league ${lg.id}...`);
      const buffer = await downloadImageBuffer(lg.logo_url);
      const filePath = `leagues/${lg.id}.png`;
      
      const { error: uploadErr } = await supabase.storage.from('logos').upload(filePath, buffer, { contentType: 'image/png', upsert: true });
      if (uploadErr) { console.error('Upload error:', uploadErr); continue; }
      
      const newUrl = `${supabaseUrl}/storage/v1/object/public/logos/${filePath}`;
      await supabase.from('leagues').update({ logo_url: newUrl }).eq('id', lg.id);
      console.log(`Migrated league ${lg.id} -> ${newUrl}`);
    } catch (e) {
      console.error(`Error on league ${lg.id}:`, e.message);
    }
  }

  console.log('Fetching teams to migrate...');
  const { data: teams } = await supabase
    .from('teams')
    .select('id, logo_url')
    .like('logo_url', 'https://media.api-sports.io%');
    
  console.log(`Found ${teams?.length || 0} teams to migrate.`);

  // To speed it up, we can do batches of 10
  const batchSize = 10;
  for (let i = 0; i < (teams || []).length; i += batchSize) {
    const batch = teams.slice(i, i + batchSize);
    await Promise.all(batch.map(async (t) => {
      try {
        const buffer = await downloadImageBuffer(t.logo_url);
        const filePath = `teams/${t.id}.png`;
        
        const { error: uploadErr } = await supabase.storage.from('logos').upload(filePath, buffer, { contentType: 'image/png', upsert: true });
        if (uploadErr) { console.error('Upload error:', uploadErr); return; }
        
        const newUrl = `${supabaseUrl}/storage/v1/object/public/logos/${filePath}`;
        await supabase.from('teams').update({ logo_url: newUrl }).eq('id', t.id);
        console.log(`Migrated team ${t.id}`);
      } catch (e) {
        console.error(`Error on team ${t.id}:`, e.message);
      }
    }));
  }

  console.log('Migration complete!');
}

migrateLogos().catch(console.error);
