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

async function saveCorrectedTicket() {
  // Buscar logos
  const { data: teams } = await supabase.from('teams').select('name, logo_url');
  const logoMap = {};
  teams.forEach(t => logoMap[t.name] = t.logo_url);

  const entries = [
    {
      fixture_id: 1379323,
      home: "Liverpool",
      away: "Chelsea",
      homeLogo: logoMap["Liverpool"] || "https://media.api-sports.io/football/teams/40.png",
      awayLogo: logoMap["Chelsea"] || "https://media.api-sports.io/football/teams/49.png",
      date_time: "2026-05-09T08:30:00Z",
      picks: [
        { team: "Liverpool", line: "Mais de 2.5", stat: "CHUTES_GOL", period: "FT", odd: 1.10, probability: 100, market: "Chutes ao Gol" },
        { team: "Chelsea", line: "Mais de 0.5", stat: "CARTÕES", period: "FT", odd: 1.05, probability: 100, market: "Total de Cartões" },
        { team: "Liverpool", line: "Menos de 2.0", stat: "CARTÕES", period: "HT", odd: 1.10, probability: 100, market: "Cartões 1T" },
        { team: "Liverpool", line: "1+", stat: "DEFESAS", period: "FT", odd: 1.05, probability: 100, market: "Defesa Goleiro LIVERPOOL" }
      ]
    },
    {
      fixture_id: 1391162,
      home: "Elche",
      away: "Alaves",
      homeLogo: logoMap["Elche"] || "https://media.api-sports.io/football/teams/797.png",
      awayLogo: logoMap["Alaves"] || "https://media.api-sports.io/football/teams/542.png",
      date_time: "2026-05-09T09:00:00Z",
      picks: [
        { team: "Alaves", line: "Menos de 3.0", stat: "CARTÕES", period: "HT", odd: 1.05, probability: 100, market: "Cartões 1T" },
        { team: "Elche", line: "Menos de 3.0", stat: "CARTÕES", period: "HT", odd: 1.05, probability: 100, market: "Cartões 1T" }
      ]
    },
    {
      fixture_id: 1378214,
      home: "Cagliari",
      away: "Udinese",
      homeLogo: logoMap["Cagliari"] || "https://media.api-sports.io/football/teams/490.png",
      awayLogo: logoMap["Udinese"] || "https://media.api-sports.io/football/teams/494.png",
      date_time: "2026-05-09T10:00:00Z",
      picks: [
        { team: "Udinese", line: "Menos de 6.0", stat: "ESCANTEIOS", period: "HT", odd: 1.04, probability: 100, market: "Escanteios 1T" },
        { team: "Cagliari", line: "Menos de 6.0", stat: "ESCANTEIOS", period: "HT", odd: 1.04, probability: 100, market: "Escanteios 1T" },
        { team: "Udinese", line: "Menos de 3.5", stat: "CHUTES_GOL", period: "HT", odd: 1.04, probability: 100, market: "Chutes ao Gol 1T" }
      ]
    },
    {
      fixture_id: 1388596,
      home: "Augsburg",
      away: "Borussia M'gladbach",
      homeLogo: logoMap["Augsburg"] || "https://media.api-sports.io/football/teams/170.png",
      awayLogo: logoMap["Borussia M'gladbach"] || "https://media.api-sports.io/football/teams/163.png",
      date_time: "2026-05-09T10:30:00Z",
      picks: [
        { team: "Augsburg", line: "Menos de 4.0", stat: "GOLS", period: "FT", odd: 1.10, probability: 100, market: "Total de Gols" },
        { team: "Augsburg", line: "Mais de 0.5", stat: "CARTÕES", period: "FT", odd: 1.10, probability: 100, market: "Total de Cartões" }
      ]
    }
  ];

  const { error } = await supabase.from('odd_tickets').upsert({
    date: '2026-05-09',
    mode: '2.0',
    matches_count: entries.length,
    total_odd: '2.08',
    status: 'PENDING',
    ticket_data: {
      entries,
      confidence_score: 100,
      generated_at: new Date().toISOString()
    }
  }, { onConflict: 'date,mode' });

  if (error) console.error('Erro ao atualizar:', error);
  else console.log('✓ Bilhete 2.0 atualizado com logos e pick corrigido.');
}

saveCorrectedTicket();
