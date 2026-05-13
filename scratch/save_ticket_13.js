
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1].trim()] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function save() {
  const ticketDate = '2026-05-13';
  const mode = '2.0';
  
  const entries = [
    {
      fixture_id: 1387951,
      home: 'Stade Brestois 29',
      away: 'Strasbourg',
      homeLogo: 'https://media.api-sports.io/football/teams/106.png',
      awayLogo: 'https://media.api-sports.io/football/teams/98.png',
      date_time: '2026-05-13T17:00:00+00:00',
      picks: [
        {
          team: 'Strasbourg',
          stat: 'CARTÕES',
          period: 'FT',
          line: 'Mais de 1.5',
          type: 'OVER',
          odd: 1.62,
          probability: 100,
          market: 'Cartões JOGO (Fora)',
          teamTarget: 'AWAY'
        }
      ]
    },
    {
      fixture_id: 1391169,
      home: 'Alaves',
      away: 'Barcelona',
      homeLogo: 'https://media.api-sports.io/football/teams/542.png',
      awayLogo: 'https://media.api-sports.io/football/teams/529.png',
      date_time: '2026-05-13T19:30:00+00:00',
      picks: [
        {
          team: 'Barcelona',
          stat: 'GOLS',
          period: 'FT',
          line: 'Mais de 0.5',
          type: 'OVER',
          odd: 1.14,
          probability: 95,
          market: 'Gols JOGO (Fora)',
          teamTarget: 'AWAY'
        }
      ]
    },
    {
      fixture_id: 1391173,
      home: 'Getafe',
      away: 'Mallorca',
      homeLogo: 'https://media.api-sports.io/football/teams/546.png',
      awayLogo: 'https://media.api-sports.io/football/teams/798.png',
      date_time: '2026-05-13T19:30:00+00:00',
      picks: [
        {
          team: 'Getafe',
          stat: 'GOLS',
          period: 'FT',
          line: 'Menos de 2.5',
          type: 'UNDER',
          odd: 1.11,
          probability: 90,
          market: 'Gols JOGO (Casa)',
          teamTarget: 'HOME'
        }
      ]
    }
  ];

  const totalOdd = (1.62 * 1.14 * 1.11).toFixed(2);
  const ticketData = {
    entries,
    confidence_score: 95,
    generated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('odd_tickets').upsert({
    date: ticketDate,
    mode: mode,
    total_odd: parseFloat(totalOdd),
    matches_count: entries.length,
    status: 'PENDING',
    ticket_data: ticketData
  }, { onConflict: 'date,mode' });

  if (error) {
    console.error('Error saving ticket:', error);
  } else {
    console.log(`Ticket 2.0 for ${ticketDate} saved with odd ${totalOdd}`);
  }
}

save();
