/**
 * Cria manualmente o bilhete 2.0 de 2026-05-05
 * Arsenal vs Atlético de Madrid (Champions League)
 * Picks conforme bolão Bet365 — odd 1.90
 *
 * Rodar: node scratch/createArsenalTicket.js
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = process.env;
try {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) { let v = m[2].trim(); if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1); env[m[1].trim()] = v; }
  });
} catch (_) {}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const DATE   = '2026-05-05';
const FIX_ID = 1540843;          // Arsenal vs Atletico Madrid — api_id confirmado

// ── Busca dados do fixture no banco ──────────────────────────────────────────
const { data: fix } = await supabase
  .from('fixtures')
  .select('api_id, date, home_team:teams!fixtures_home_team_id_fkey(name,logo_url), away_team:teams!fixtures_away_team_id_fkey(name,logo_url)')
  .eq('api_id', FIX_ID)
  .single();

if (!fix) { console.error('Fixture não encontrado no banco.'); process.exit(1); }

const home     = fix.home_team.name;
const away     = fix.away_team.name;
const homeLogo = fix.home_team.logo_url;
const awayLogo = fix.away_team.logo_url;
console.log(`Fixture: ${home} vs ${away}  |  ${fix.date}`);

// ── Picks (excluindo David Raya) ──────────────────────────────────────────────
// Odds individuais distribuídas para que o produto = 1.90
// Atualize os valores de 'odd' se tiver os valores exatos do slip Bet365
const picks = [
  {
    market:     'Chutes FT (Casa)',
    stat:       'CHUTES',
    period:     'FT',
    teamTarget: 'HOME',
    team:       home,
    type:       'OVER',
    threshold:  12.5,
    line:       'Mais de 12.5',
    odd:        1.14,
    probability: 86,
  },
  {
    market:     'Chutes FT (Fora)',
    stat:       'CHUTES',
    period:     'FT',
    teamTarget: 'AWAY',
    team:       away,
    type:       'OVER',
    threshold:  5.5,
    line:       'Mais de 5.5',
    odd:        1.11,
    probability: 87,
  },
  {
    market:     'Escanteios 1T (Casa)',
    stat:       'ESCANTEIOS',
    period:     'HT',
    teamTarget: 'HOME',
    team:       home,
    type:       'OVER',
    threshold:  0,
    line:       'Mais de 0',
    odd:        1.08,
    probability: 92,
  },
  {
    market:     'Cartões 1T (Fora)',
    stat:       'CARTÕES',
    period:     'HT',
    teamTarget: 'AWAY',
    team:       away,
    type:       'UNDER',
    threshold:  3,
    line:       'Menos de 3',
    odd:        1.11,
    probability: 88,
  },
  {
    market:     'Cartões FT (Fora)',
    stat:       'CARTÕES',
    period:     'FT',
    teamTarget: 'AWAY',
    team:       away,
    type:       'OVER',
    threshold:  1,
    line:       'Mais de 1',
    odd:        1.12,
    probability: 87,
  },
  {
    market:     'Escanteios FT (Fora)',
    stat:       'ESCANTEIOS',
    period:     'FT',
    teamTarget: 'AWAY',
    team:       away,
    type:       'UNDER',
    threshold:  8,
    line:       'Menos de 8',
    odd:        1.16,
    probability: 86,
  },
  {
    market:     'Escanteios FT (Fora)',
    stat:       'ESCANTEIOS',
    period:     'FT',
    teamTarget: 'AWAY',
    team:       away,
    type:       'OVER',
    threshold:  0,
    line:       'Mais de 0',
    odd:        1.07,
    probability: 95,
  },
];

// Verifica produto das odds
const product = picks.reduce((acc, p) => acc * p.odd, 1);
console.log(`Produto das odds individuais: ${product.toFixed(3)} (alvo: 1.90)`);

// ── Monta ticket ──────────────────────────────────────────────────────────────
const ticket = {
  date:          DATE,
  mode:          '2.0',
  status:        'PENDING',
  total_odd:     '1.90',
  matches_count: 1,
  ticket_data: {
    confidence_score: 88,
    entries: [
      {
        fixture_id: FIX_ID,
        home,
        away,
        homeLogo,
        awayLogo,
        date_time: fix.date,
        picks,
      },
    ],
  },
};

// ── Verifica conflito ─────────────────────────────────────────────────────────
const { data: existing } = await supabase
  .from('odd_tickets')
  .select('date, status, total_odd, matches_count')
  .eq('date', DATE)
  .eq('mode', '2.0')
  .maybeSingle();

if (existing) {
  console.log(`\nTicket existente: status=${existing.status}  odd=${existing.total_odd}  matches=${existing.matches_count}`);
  if (existing.matches_count > 0 && existing.status !== 'PENDING') {
    console.error('⚠️  Ticket já tem jogos reais e está resolvido. Abortando por segurança.');
    console.error('   Edite o script e remova esta proteção se quiser mesmo sobrescrever.');
    process.exit(1);
  }
  console.log('Ticket vazio/pendente — sobrescrevendo...');
  const { error } = await supabase
    .from('odd_tickets')
    .update(ticket)
    .eq('date', DATE)
    .eq('mode', '2.0');
  if (error) { console.error('Erro no update:', error.message); process.exit(1); }
} else {
  const { error } = await supabase.from('odd_tickets').insert(ticket);
  if (error) { console.error('Erro no insert:', error.message); process.exit(1); }
}

console.log(`\n✅ Bilhete 2.0 criado: ${home} vs ${away}  |  odd 1.90  |  ${picks.length} picks`);
console.log('   ⚠️  Odds individuais são estimadas — atualize os valores se tiver o slip completo.');
