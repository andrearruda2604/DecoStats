/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { MOCK_MATCHES_BY_DATE, MOCK_MATCH_DETAIL, MOCK_LEAGUES } from '../constants';
import type { MatchCardData, MatchDetailData, StatComparison, ToggleMode } from '../types';

// ─── Matches List ───────────────────────────────────────────────────

export async function fetchMatches(
  date: string,
  leagueId?: number
): Promise<MatchCardData[]> {
  if (!isSupabaseConfigured) {
    return MOCK_MATCHES_BY_DATE;
  }

  let query = supabase
    .from('fixtures')
    .select(`
      id, api_id, date, status, home_score, away_score, round,
      league:leagues!fixtures_league_id_fkey(name, country, country_code, flag_url, logo_url),
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url)
    `)
    .gte('date', `${date}T00:00:00`)
    .lte('date', `${date}T23:59:59`)
    .order('date', { ascending: true });

  if (leagueId) {
    query = query.eq('league_id', leagueId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((f: any) => ({
    id: f.id,
    apiId: f.api_id,
    league: {
      name: f.league?.name || '',
      country: f.league?.country || '',
      countryCode: f.league?.country_code || '',
      flagUrl: f.league?.flag_url || '',
      logoUrl: f.league?.logo_url || '',
    },
    time: new Date(f.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    date: f.date,
    status: f.status,
    homeTeam: {
      id: f.home_team?.id || 0,
      name: f.home_team?.name || '',
      logoUrl: f.home_team?.logo_url || '',
      score: f.home_score,
    },
    awayTeam: {
      id: f.away_team?.id || 0,
      name: f.away_team?.name || '',
      logoUrl: f.away_team?.logo_url || '',
      score: f.away_score,
    },
    round: f.round || '',
  }));
}

// ─── Match Detail & Stats ───────────────────────────────────────────

export async function fetchMatchDetail(fixtureId: number): Promise<MatchDetailData> {
  if (!isSupabaseConfigured) {
    return MOCK_MATCH_DETAIL;
  }

  // Fetch fixture with teams and league
  const { data: fixture, error: fErr } = await supabase
    .from('fixtures')
    .select(`
      *,
      league:leagues!fixtures_league_id_fkey(*),
      home_team:teams!fixtures_home_team_id_fkey(*),
      away_team:teams!fixtures_away_team_id_fkey(*)
    `)
    .eq('id', fixtureId)
    .single();

  if (fErr || !fixture) throw fErr || new Error('Fixture not found');

  // Fetch stats for all periods
  const { data: stats, error: sErr } = await supabase
    .from('fixture_stats')
    .select('*')
    .eq('fixture_id', fixtureId);

  if (sErr) throw sErr;

  // Fetch events
  const { data: events, error: eErr } = await supabase
    .from('fixture_events')
    .select('*')
    .eq('fixture_id', fixtureId)
    .order('elapsed', { ascending: true });

  if (eErr) throw eErr;

  // Process stats into comparison format
  const processedStats = processStats(
    stats || [],
    fixture.home_team?.id,
    fixture.away_team?.id
  );

  const predictiveStats = generatePredictiveData(
    fixture.home_team?.id || 0,
    fixture.away_team?.id || 0
  );

  return {
    fixture,
    homeTeam: fixture.home_team,
    awayTeam: fixture.away_team,
    league: fixture.league,
    stats: processedStats,
    predictive: predictiveStats,
    events: events || [],
  };
}

// ─── Stats Processing ───────────────────────────────────────────────

const STAT_CONFIG: { key: string; label: string; subLabel: string; type: 'higher-better' | 'lower-better' | 'neutral' }[] = [
  { key: 'shots_total', label: 'CHUTES', subLabel: 'TOTAL SHOT ACCURACY', type: 'higher-better' },
  { key: 'shots_on_goal', label: 'CHUTES NO GOL', subLabel: 'TARGET CONVERSION', type: 'higher-better' },
  { key: 'corners', label: 'ESCANTEIOS', subLabel: 'SET-PIECE FREQUENCY', type: 'higher-better' },
  { key: 'possession', label: 'POSSE DE BOLA', subLabel: 'POSSESSION DOMINANCE', type: 'higher-better' },
  { key: 'yellow_cards', label: 'CARTÃO AMARELO', subLabel: 'DISCIPLINARY INDEX', type: 'lower-better' },
  { key: 'red_cards', label: 'CARTÃO VERMELHO', subLabel: 'CRITICAL FOUL', type: 'lower-better' },
  { key: 'goals', label: 'GOLS', subLabel: 'OFFENSIVE YIELD', type: 'higher-better' },
  { key: 'fouls', label: 'FALTAS', subLabel: 'FOUL RATE', type: 'lower-better' },
  { key: 'offsides', label: 'IMPEDIMENTOS', subLabel: 'OFFSIDE FREQUENCY', type: 'neutral' },
];

function processStats(
  stats: any[],
  homeTeamId: number,
  awayTeamId: number
): MatchDetailData['stats'] {
  const result: MatchDetailData['stats'] = { FT: [], HT: [], '2H': [] };

  for (const period of ['FT', 'HT', '2H'] as const) {
    const homeStat = stats.find(s => s.team_id === homeTeamId && s.period === period);
    const awayStat = stats.find(s => s.team_id === awayTeamId && s.period === period);

    result[period] = STAT_CONFIG.map(cfg => ({
      label: cfg.label,
      subLabel: cfg.subLabel,
      homeValue: homeStat ? (homeStat[cfg.key] ?? 0) : 0,
      awayValue: awayStat ? (awayStat[cfg.key] ?? 0) : 0,
      type: cfg.type,
    }));
  }

  return result;
}

// ─── Search ─────────────────────────────────────────────────────────

export async function searchTeams(query: string) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('teams')
    .select('id, name, logo_url, short_name')
    .ilike('name', `%${query}%`)
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function fetchLeagues() {
  if (!isSupabaseConfigured) {
    return MOCK_LEAGUES;
  }

  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

// ─── Predictive Mocking ─────────────────────────────────────────────

function getSeededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generatePredictiveData(homeTeamId: number, awayTeamId: number, count: number = 5, scope: string = 'season') {
  const scopeMod = scope === 'all' ? 1.2 : 1.0;
  const seedBase = homeTeamId * 1000 + awayTeamId + 1;
  const periods = ['FT', 'HT', '2H'] as const;
  
  const predictiveConf = [
    { key: 'shots_total', label: 'CHUTES', subLabel: 'PRECISÃO TOTAL DE CHUTES', baseH: 10, rangeH: 6, baseA: 8, rangeA: 5 },
    { key: 'shots_on_goal', label: 'CHUTES NO GOL', subLabel: 'EFICIÊNCIA DE CONVERSÃO NO ALVO', baseH: 4, rangeH: 3, baseA: 3, rangeA: 2 },
    { key: 'corners', label: 'ESCANTEIOS', subLabel: 'FREQUÊNCIA DE BOLAS PARADAS', baseH: 4, rangeH: 5, baseA: 3, rangeA: 4 },
    { key: 'yellow_cards', label: 'CARTÃO AMARELO', subLabel: 'ÍNDICE DE VOLATILIDADE DISCIPLINAR', baseH: 1, rangeH: 2, baseA: 1, rangeA: 2 },
    { key: 'red_cards', label: 'CARTÃO VERMELHO', subLabel: 'OCORRÊNCIA DE FALTAS CRÍTICAS', baseH: 0, rangeH: 1, baseA: 0, rangeA: 1 },
    { key: 'goals_for', label: 'GOLS MARCADOS', subLabel: 'RENDIMENTO OFENSIVO PRIMÁRIO', baseH: 1, rangeH: 2, baseA: 1, rangeA: 2, highlight: 'green' as const },
    { key: 'goals_against', label: 'GOLS SOFRIDOS', subLabel: 'NÍVEL DE RESISTÊNCIA DEFENSIVA', baseH: 1, rangeH: 2, baseA: 1, rangeA: 2 },
  ];

  const result: any = {};
  
  for (const period of periods) {
     const mult = (period === 'FT' ? 1 : 0.5) * scopeMod;
     result[period] = predictiveConf.map((cfg, i) => {
        const hSeed = seedBase + i * 10 + (period === 'FT' ? 1 : period === 'HT' ? 2 : 3);
        const aSeed = seedBase * 2 + i * 10 + (period === 'FT' ? 1 : period === 'HT' ? 2 : 3);
        
        const hMin = Math.round(cfg.baseH * mult + getSeededRandom(hSeed) * 2);
        const hMax = hMin + Math.round(cfg.rangeH * mult + getSeededRandom(hSeed + 10) * 2);
        const hDist = Array.from({length: count}, (_, j) => Math.floor(Math.max(hMin, Math.min(hMax, (hMin + hMax)/2 + (getSeededRandom(hSeed + 20 + j) - 0.5) * cfg.rangeH))));

        const aMin = Math.round(cfg.baseA * mult + getSeededRandom(aSeed) * 2);
        const aMax = aMin + Math.round(cfg.rangeA * mult + getSeededRandom(aSeed + 10) * 2);
        const aDist = Array.from({length: count}, (_, j) => Math.floor(Math.max(aMin, Math.min(aMax, (aMin + aMax)/2 + (getSeededRandom(aSeed + 20 + j) - 0.5) * cfg.rangeA))));

        return {
          label: cfg.label,
          subLabel: cfg.subLabel,
          homeMin: hMin,
          homeMax: hMax,
          homeDist: hDist,
          awayMin: aMin,
          awayMax: aMax,
          awayDist: aDist,
          highlight: cfg.highlight || 'none'
        }
     });
  }
  return result;
}

export async function fetchPredictiveData(homeTeamId: number, awayTeamId: number, count: number = 5, scope: string = 'season') {
  if (!isSupabaseConfigured) {
    return generatePredictiveData(homeTeamId, awayTeamId, count, scope);
  }

  try {
    let homeQ = supabase.from('teams_history').select('*').eq('team_id', homeTeamId).order('match_date', { ascending: false }).limit(count);
    let awayQ = supabase.from('teams_history').select('*').eq('team_id', awayTeamId).order('match_date', { ascending: false }).limit(count);

    const [homeRes, awayRes] = await Promise.all([homeQ, awayQ]);
    
    const homeData = homeRes.data || [];
    const awayData = awayRes.data || [];

    // Fallback to mock if we don't have enough data (e.g. at least 3 matches)
    if (homeData.length < 3 && awayData.length < 3) {
      return generatePredictiveData(homeTeamId, awayTeamId, count, scope);
    }

    const periods = ['FT', 'HT', '2H'] as const;
    const predictiveConf = [
      { key: 'shots_total', label: 'CHUTES', subLabel: 'PRECISÃO TOTAL DE CHUTES', dbKey: 'shots_total' },
      { key: 'shots_on_goal', label: 'CHUTES NO GOL', subLabel: 'EFICIÊNCIA DE CONVERSÃO NO ALVO', dbKey: 'shots_on_goal' },
      { key: 'corners', label: 'ESCANTEIOS', subLabel: 'FREQUÊNCIA DE BOLAS PARADAS', dbKey: 'corners' },
      { key: 'yellow_cards', label: 'CARTÃO AMARELO', subLabel: 'ÍNDICE DE VOLATILIDADE DISCIPLINAR', dbKey: 'yellow_cards' },
      { key: 'red_cards', label: 'CARTÃO VERMELHO', subLabel: 'OCORRÊNCIA DE FALTAS CRÍTICAS', dbKey: 'red_cards' },
      { key: 'goals_for', label: 'GOLS MARCADOS', subLabel: 'RENDIMENTO OFENSIVO PRIMÁRIO', dbKey: 'goals_for', highlight: 'green' as const },
      { key: 'goals_against', label: 'GOLS SOFRIDOS', subLabel: 'NÍVEL DE RESISTÊNCIA DEFENSIVA', dbKey: 'goals_against' },
    ];

    const result: any = {};

    for (const period of periods) {
      // In this PoC, we will simulate the HT / 2H splits by dividing the FT data by 2 since API-Football free mostly gives FT stats
      const mult = period === 'FT' ? 1 : 0.5;
      
      result[period] = predictiveConf.map(cfg => {
          let hDist = homeData.map((row: any) => Math.round((row[cfg.dbKey] || 0) * mult));
          let aDist = awayData.map((row: any) => Math.round((row[cfg.dbKey] || 0) * mult));
          
          if (hDist.length === 0) hDist = [0];
          if (aDist.length === 0) aDist = [0];

          return {
            label: cfg.label,
            subLabel: cfg.subLabel,
            homeMin: Math.min(...hDist),
            homeMax: Math.max(...hDist),
            homeDist: hDist,
            awayMin: Math.min(...aDist),
            awayMax: Math.max(...aDist),
            awayDist: aDist,
            highlight: cfg.highlight || 'none'
          };
      });
    }

    return result;

  } catch (err) {
    console.error("Error fetching predictive data:", err);
    return generatePredictiveData(homeTeamId, awayTeamId, count, scope);
  }
}

