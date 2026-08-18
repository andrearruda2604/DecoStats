import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import https from 'https';

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

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const supabase = createClient(SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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

async function run() {
  console.log('Checking Teams...');
  const { data: teams } = await supabase.from('teams').select('id, name, logo_url');
  const badTeams = teams.filter(t => !t.logo_url || t.logo_url.includes('api-sports'));
  
  if (badTeams.length > 0) {
    console.log(`Found ${badTeams.length} teams with missing/api-sports logos:`);
    for (const t of badTeams) {
      console.log(`- ${t.name} (${t.logo_url})`);
      if (t.logo_url) {
        try {
          const buffer = await downloadImageBuffer(t.logo_url);
          const filePath = `teams/${t.id}.png`;
          const { error } = await supabase.storage.from('logos').upload(filePath, buffer, { contentType: 'image/png', upsert: true });
          if (!error) {
            const newUrl = `${SUPABASE_URL}/storage/v1/object/public/logos/${filePath}`;
            await supabase.from('teams').update({ logo_url: newUrl }).eq('id', t.id);
            console.log(`  -> Migrated!`);
          }
        } catch(e) { console.error('  -> Failed:', e.message); }
      }
    }
  } else {
    console.log('All teams logos are valid and in storage.');
  }

  console.log('\nChecking Leagues...');
  const { data: leagues } = await supabase.from('leagues').select('id, name, logo_url, api_id');
  const badLeagues = leagues.filter(l => !l.logo_url || l.logo_url.includes('api-sports'));
  
  if (badLeagues.length > 0) {
    console.log(`Found ${badLeagues.length} leagues with missing/api-sports logos:`);
    for (const l of badLeagues) {
      console.log(`- ${l.name} (${l.logo_url})`);
      let sourceUrl = l.logo_url;
      if (!sourceUrl && l.api_id) {
         sourceUrl = `https://media.api-sports.io/football/leagues/${l.api_id}.png`;
      }
      if (sourceUrl) {
        try {
          const buffer = await downloadImageBuffer(sourceUrl);
          const filePath = `leagues/${l.id}.png`;
          const { error } = await supabase.storage.from('logos').upload(filePath, buffer, { contentType: 'image/png', upsert: true });
          if (!error) {
            const newUrl = `${SUPABASE_URL}/storage/v1/object/public/logos/${filePath}`;
            await supabase.from('leagues').update({ logo_url: newUrl }).eq('id', l.id);
            console.log(`  -> Migrated!`);
          }
        } catch(e) { console.error('  -> Failed:', e.message); }
      }
    }
  } else {
    console.log('All leagues logos are valid and in storage.');
  }
}

run();
