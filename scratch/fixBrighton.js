import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').filter(l => l.includes('=')).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fix() {
    console.log("🔍 Buscando Brighton...");
    const { data: team } = await supabase.from('teams').select('id, name, logo_url').ilike('name', '%Brighton%').single();
    
    if (team) {
        console.log(`Time encontrado: ${team.name} (ID: ${team.id})`);
        console.log(`Logo atual: ${team.logo_url}`);
        
        // United é ID 33. Brighton é ID 51 na API-Football (ou 34 dependendo da versão). 
        // No seu sistema parece que o 33 foi parar no Brighton.
        const correctLogo = 'https://media.api-sports.io/football/teams/51.png'; 
        
        console.log(`Corrigindo para: ${correctLogo}`);
        await supabase.from('teams').update({ logo_url: correctLogo }).eq('id', team.id);
        console.log("✅ Logo do Brighton corrigido no banco!");
        
        // IMPORTANTE: Precisa atualizar o bilhete de hoje também, pois ele salva o logo no JSON
        console.log("🛠️ Atualizando bilhete de hoje...");
        const today = new Date().toISOString().split('T')[0];
        const { data: ticket } = await supabase.from('odd_tickets').select('*').eq('date', today).maybeSingle();
        
        if (ticket && ticket.ticket_data) {
            const entries = ticket.ticket_data.entries.map(e => {
                if (e.home.includes('Brighton')) e.homeLogo = correctLogo;
                if (e.away.includes('Brighton')) e.awayLogo = correctLogo;
                return e;
            });
            await supabase.from('odd_tickets').update({ ticket_data: { ...ticket.ticket_data, entries } }).eq('id', ticket.id);
            console.log("✅ Bilhete de hoje atualizado com o logo correto!");
        }
    }
}

fix();
