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

// Known working URLs for the 2026 FIFA World Cup emblem
const candidates = [
  'https://upload.wikimedia.org/wikipedia/en/3/3b/2026_FIFA_World_Cup_emblem.svg',
  'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/2026_FIFA_World_Cup_emblem.svg/200px-2026_FIFA_World_Cup_emblem.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/2026_FIFA_World_Cup.svg/200px-2026_FIFA_World_Cup.svg.png',
  'https://upload.wikimedia.org/wikipedia/en/3/3b/2026_FIFA_World_Cup.svg',
  'https://crests.football-data.org/WC.png',
  'https://img.icons8.com/color/200/fifa-world-cup.png',
];

async function tryAndUpload() {
  // Try each candidate
  for (const url of candidates) {
    try {
      console.log(`Trying: ${url}`);
      const resp = await fetch(url);
      if (!resp.ok) {
        console.log(`  ❌ Status ${resp.status}`);
        continue;
      }
      const contentType = resp.headers.get('content-type');
      console.log(`  ✓ Status ${resp.status}, Content-Type: ${contentType}`);
      
      const buffer = Buffer.from(await resp.arrayBuffer());
      const ext = contentType?.includes('svg') ? 'svg' : 'png';
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(`leagues/world_cup_2026.${ext}`, buffer, {
          contentType: contentType || 'image/png',
          upsert: true
        });
      
      if (error) {
        console.log(`  Upload error: ${error.message}`);
        continue;
      }
      
      const publicUrl = `${env['VITE_SUPABASE_URL']}/storage/v1/object/public/logos/leagues/world_cup_2026.${ext}`;
      console.log(`  Uploaded! Public URL: ${publicUrl}`);
      
      // Update league
      await supabase.from('leagues').update({ logo_url: publicUrl }).eq('api_id', 1);
      console.log('  League logo updated!');
      return;
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // Fallback: use the api-sports logo as last resort and download it to storage
  console.log('\nAll candidates failed. Using api-sports logo and uploading to storage...');
  const fallbackUrl = 'https://media.api-sports.io/football/leagues/1.png';
  const resp = await fetch(fallbackUrl);
  if (resp.ok) {
    const buffer = Buffer.from(await resp.arrayBuffer());
    await supabase.storage.from('logos').upload('leagues/world_cup_2026.png', buffer, {
      contentType: 'image/png',
      upsert: true
    });
    const publicUrl = `${env['VITE_SUPABASE_URL']}/storage/v1/object/public/logos/leagues/world_cup_2026.png`;
    await supabase.from('leagues').update({ logo_url: publicUrl }).eq('api_id', 1);
    console.log('Fallback uploaded:', publicUrl);
  }
}

tryAndUpload().catch(console.error);
