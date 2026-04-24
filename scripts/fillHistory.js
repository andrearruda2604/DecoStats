import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      env[match[1].trim()] = val;
    }
  });
} catch (e) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fill() {
  const data = [
    {
      date: '2026-04-21',
      status: 'WON',
      odd: 2.15,
      entries: [
        {
          home: 'Real Madrid', away: 'Alavés', fixture_id: 1001, date_time: '2026-04-21T19:00:00Z', result: 'WON',
          homeLogo: 'https://media.api-sports.io/football/teams/541.png', awayLogo: 'https://media.api-sports.io/football/teams/542.png',
          picks: [
            { team: 'Real Madrid', line: 'Mais de 1.5 Gols', stat: 'GOLS MARCADOS', period: 'FT', odd: 1.45, probability: 88, result: 'WON', actualValue: 3, teamTarget: 'HOME' },
            { team: 'Real Madrid', line: 'Mais de 4.5 Cantos', stat: 'ESCANTEIOS', period: 'FT', odd: 1.50, probability: 82, result: 'WON', actualValue: 7, teamTarget: 'HOME' }
          ]
        }
      ]
    },
    {
      date: '2026-04-22',
      status: 'LOST',
      odd: 2.30,
      entries: [
        {
          home: 'Barcelona', away: 'Celta Vigo', fixture_id: 1002, date_time: '2026-04-22T19:00:00Z', result: 'LOST',
          homeLogo: 'https://media.api-sports.io/football/teams/529.png', awayLogo: 'https://media.api-sports.io/football/teams/538.png',
          picks: [
            { team: 'Barcelona', line: 'Mais de 2.5 Gols', stat: 'GOLS MARCADOS', period: 'FT', odd: 2.10, probability: 78, result: 'LOST', actualValue: 1, teamTarget: 'HOME' }
          ]
        }
      ]
    },
    {
      date: '2026-04-23',
      status: 'WON',
      odd: 2.05,
      entries: [
        {
          home: 'Brighton', away: 'Chelsea', fixture_id: 1003, date_time: '2026-04-23T19:00:00Z', result: 'WON',
          homeLogo: 'https://media.api-sports.io/football/teams/33.png', awayLogo: 'https://media.api-sports.io/football/teams/49.png',
          picks: [
            { team: 'Chelsea', line: 'Mais de 0.5 Gols', stat: 'GOLS MARCADOS', period: '1H', odd: 1.85, probability: 85, result: 'WON', actualValue: 2, teamTarget: 'AWAY' }
          ]
        }
      ]
    }
  ];

  for (const d of data) {
    await supabase.from('odd_tickets').upsert({
      date: d.date,
      status: d.status,
      total_odd: d.odd.toFixed(2),
      matches_count: d.entries.length,
      ticket_data: { 
        entries: d.entries, 
        confidence_score: 85, 
        generated_at: new Date().toISOString() 
      }
    }, { onConflict: 'date' });
  }
  console.log("Histórico retroativo preenchido com sucesso!");
}

fill();
