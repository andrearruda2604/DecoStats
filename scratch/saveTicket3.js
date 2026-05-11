import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

const entries = [
  {
    fixture_id: 1378214,
    home: "Cagliari",
    away: "Udinese",
    date_time: "2026-05-09T13:00:00.000Z",
    picks: [
      { team: "Total", line: "Mais de 0.5", stat: "GOLS", period: "FT", odd: 1.08, probability: 97, market: "Gols FT (Total)" }
    ]
  },
  {
    fixture_id: 1380312,
    home: "Brighton",
    away: "Wolves",
    date_time: "2026-05-09T14:00:00.000Z",
    picks: [
      { team: "Brighton", line: "Menos de 3.5", stat: "GOLS", period: "FT", odd: 1.28, probability: 100, market: "Gols FT (Casa)" },
      { team: "Total", line: "Menos de 4.5", stat: "GOLS", period: "FT", odd: 1.25, probability: 97, market: "Gols FT (Total)" }
    ]
  },
  {
    fixture_id: 1380321,
    home: "Sunderland",
    away: "Manchester United",
    date_time: "2026-05-09T14:00:00.000Z",
    picks: [
      { team: "Manchester United", line: "Mais de 0.5", stat: "GOLS", period: "FT", odd: 1.17, probability: 100, market: "Gols FT (Fora)" }
    ]
  },
  {
    fixture_id: 1388596,
    home: "Augsburg",
    away: "Borussia M'gladbach",
    date_time: "2026-05-09T13:30:00.000Z",
    picks: [
      { team: "Augsburg", line: "Menos de 3.5", stat: "GOLS", period: "FT", odd: 1.08, probability: 100, market: "Gols FT (Casa)" }
    ]
  },
  {
    fixture_id: 1384594,
    home: "Talleres Cordoba",
    away: "Belgrano Cordoba",
    date_time: "2026-05-09T22:00:00.000Z",
    picks: [
      { team: "Talleres Cordoba", line: "Menos de 2.5", stat: "GOLS", period: "FT", odd: 1.08, probability: 100, market: "Gols FT (Casa)" }
    ]
  },
  {
    fixture_id: 1384587,
    home: "Boca Juniors",
    away: "Huracan",
    date_time: "2026-05-09T23:45:00.000Z",
    picks: [
      { team: "Total", line: "Menos de 3.5", stat: "GOLS", period: "FT", odd: 1.12, probability: 100, market: "Gols FT (Total)" },
      { team: "Boca Juniors", line: "Menos de 2.5", stat: "GOLS", period: "FT", odd: 1.12, probability: 100, market: "Gols FT (Casa)" }
    ]
  }
];

async function saveTicket3() {
  const { data: teams } = await supabase.from('teams').select('name, logo_url');
  const logoMap = {};
  teams.forEach(t => logoMap[t.name] = t.logo_url);

  entries.forEach(e => {
    e.homeLogo = logoMap[e.home] || "";
    e.awayLogo = logoMap[e.away] || "";
  });

  const { error } = await supabase.from('odd_tickets').upsert({
    date: '2026-05-09',
    mode: '3.0',
    matches_count: entries.length,
    total_odd: '2.96',
    status: 'PENDING',
    ticket_data: {
      entries,
      confidence_score: 99,
      generated_at: new Date().toISOString()
    }
  }, { onConflict: 'date,mode' });

  if (error) console.error('Erro ao salvar:', error);
  else console.log('✓ Bilhete 3.0 salvo com sucesso.');
}

saveTicket3();
