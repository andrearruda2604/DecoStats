/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { MOCK_MATCHES_BY_DATE, MOCK_MATCH_DETAIL, MOCK_LEAGUES } from '../constants';
import type { MatchCardData, MatchDetailData, StatComparison, ToggleMode } from '../types';

function getTimezoneOffset(): string {
  const offsetMinutes = new Date().getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
  const offsetMins = Math.abs(offsetMinutes % 60);
  const sign = offsetMinutes > 0 ? "-" : "+";
  return `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
}

// ─── Matches List ───────────────────────────────────────────────────

export async function fetchMatches(
  date: string,
  leagueIds?: number[]
): Promise<MatchCardData[]> {
  if (!isSupabaseConfigured) {
    return MOCK_MATCHES_BY_DATE;
  }

  const offset = getTimezoneOffset();

  let query = supabase
    .from('fixtures')
    .select(`
      id, api_id, date, status, home_score, away_score, round,
      league:leagues!fixtures_league_id_fkey(name, country, country_code, flag_url, logo_url),
      home_team:teams!fixtures_home_team_id_fkey(id, name, logo_url),
      away_team:teams!fixtures_away_team_id_fkey(id, name, logo_url)
    `)
    .gte('date', `${date}T00:00:00${offset}`)
    .lte('date', `${date}T23:59:59${offset}`)
    .order('date', { ascending: true });

  if (leagueIds && leagueIds.length > 0) {
    query = query.in('league_id', leagueIds);
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

// ─── Real Historical Data ───────────────────────────────────────────

const PREDICTIVE_CONF = [
  { apiType: 'Total Shots', label: 'CHUTES', subLabel: 'PRECISÃO TOTAL DE CHUTES', flatKey: 'shots_total' },
  { apiType: 'Shots on Goal', label: 'CHUTES NO GOL', subLabel: 'EFICIÊNCIA DE CONVERSÃO NO ALVO', flatKey: 'shots_on_goal' },
  { apiType: 'Ball Possession', label: 'POSSE DE BOLA (%)', subLabel: 'CONTROLE DE RITMO E ESPAÇO', flatKey: 'possession' },
  { apiType: 'Passes accurate', label: 'PASSES CERTOS', subLabel: 'EFICIÊNCIA DE CONSTRUÇÃO TÁTICA', flatKey: 'passes_accurate' },
  { apiType: 'Corner Kicks', label: 'ESCANTEIOS', subLabel: 'FREQUÊNCIA DE BOLAS PARADAS', flatKey: 'corners' },
  { apiType: 'Fouls', label: 'FALTAS COMETIDAS', subLabel: 'ÍNDICE DE QUEBRA DE RITMO', flatKey: 'fouls' },
  { apiType: 'Offsides', label: 'IMPEDIMENTOS', subLabel: 'VULNERABILIDADE À LINHA ALTA', flatKey: 'offsides' },
  { apiType: 'Goalkeeper Saves', label: 'DEFESAS DO GOLEIRO', subLabel: 'RESISTÊNCIA A CHUTES NO ALVO', flatKey: 'goalkeeper_saves' },
  { apiType: 'Yellow Cards', label: 'CARTÃO AMARELO', subLabel: 'ÍNDICE DE VOLATILIDADE DISCIPLINAR', flatKey: 'yellow_cards' },
  { apiType: 'Red Cards', label: 'CARTÃO VERMELHO', subLabel: 'OCORRÊNCIA DE FALTAS CRÍTICAS', flatKey: 'red_cards' },
  { apiType: 'goals', label: 'GOLS MARCADOS', subLabel: 'RENDIMENTO OFENSIVO PRIMÁRIO', flatKey: 'goals_for', highlight: 'green' as const },
  { apiType: 'goals_against', label: 'GOLS SOFRIDOS', subLabel: 'NÍVEL DE RESISTÊNCIA DEFENSIVA', flatKey: 'goals_against' },
];

function extractStatFromJsonb(jsonbArr: any[], apiType: string): number {
  if (!jsonbArr || jsonbArr.length === 0) return 0;
  const found = jsonbArr.find((s: any) => s.type === apiType);
  if (!found || found.value === null || found.value === undefined) return 0;
  if (typeof found.value === 'string' && found.value.includes('%')) return parseInt(found.value.replace('%', ''), 10);
  return parseInt(found.value, 10) || 0;
}

function generatePredictiveData(homeTeamId: number, awayTeamId: number, count: number = 5, _scope: string = 'all') {
  // Minimal fallback for when DB has no data - generates zeros
  const periods = ['FT', 'HT', '2H'] as const;
  const result: any = {};
  for (const period of periods) {
    result[period] = PREDICTIVE_CONF.map(cfg => ({
      label: cfg.label,
      subLabel: cfg.subLabel,
      homeMin: 0, homeMax: 0, homeDist: Array(count).fill(0),
      awayMin: 0, awayMax: 0, awayDist: Array(count).fill(0),
      highlight: (cfg as any).highlight || 'none'
    }));
  }
  return result;
}

export async function fetchPredictiveData(
  homeTeamId: number,
  awayTeamId: number,
  count: number = 20,
  options: { mandoOnly?: boolean, seasonOnly?: boolean, leagueId?: number, season?: number, matchDate?: string } = {}
) {
  if (!isSupabaseConfigured) {
    return generatePredictiveData(homeTeamId, awayTeamId, count);
  }

  try {
    const MIN_RECORDS = 3;

    async function fetchTeamData(teamId: number, isHome: boolean) {
      let q = supabase.from('teams_history').select('*').eq('team_id', teamId);
      if (options.mandoOnly) q = q.eq('is_home', isHome);
      if (options.seasonOnly && options.season) q = q.eq('season', options.season);
      if (options.leagueId) q = q.eq('league_id', options.leagueId);
      // Ponto no tempo: só usa jogos anteriores à data do fixture analisado
      if (options.matchDate) q = q.lt('match_date', options.matchDate);
      const { data } = await q.order('match_date', { ascending: false }).limit(count);
      if ((data?.length ?? 0) >= MIN_RECORDS) return data!;

      // Fallback sem filtro de liga (mantém temporada, mando e ponto-no-tempo)
      let fb = supabase.from('teams_history').select('*').eq('team_id', teamId);
      if (options.mandoOnly) fb = fb.eq('is_home', isHome);
      if (options.seasonOnly && options.season) fb = fb.eq('season', options.season);
      if (options.matchDate) fb = fb.lt('match_date', options.matchDate);
      const { data: fbData } = await fb.order('match_date', { ascending: false }).limit(count);
      return fbData || [];
    }

    const [homeData, awayData] = await Promise.all([
      fetchTeamData(homeTeamId, true),
      fetchTeamData(awayTeamId, false),
    ]);

    if (homeData.length < MIN_RECORDS && awayData.length < MIN_RECORDS) {
      return generatePredictiveData(homeTeamId, awayTeamId, count);
    }

    const periodMap: Record<string, string> = {
      FT: 'stats_ft',
      HT: 'stats_1h',
      '2H': 'stats_2h'
    };

    const result: any = {};

    for (const period of ['FT', 'HT', '2H'] as const) {
      const jsonbCol = periodMap[period];

      result[period] = PREDICTIVE_CONF.map(cfg => {
          const extractVal = (row: any): number => {
            if (cfg.apiType === 'goals') return row.goals_for || 0;
            if (cfg.apiType === 'goals_against') return row.goals_against || 0;

            const jsonbArr = row[jsonbCol];
            if (jsonbArr && jsonbArr.length > 0) {
              return extractStatFromJsonb(jsonbArr, cfg.apiType);
            }
            // Fallback to flat columns for FT if JSONB not populated yet
            if (period === 'FT') return row[cfg.flatKey] || 0;
            return 0;
          };

          let hDist = homeData.map((row: any) => extractVal(row));
          let aDist = awayData.map((row: any) => extractVal(row));

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
            highlight: (cfg as any).highlight || 'none'
          };
      });
    }

    return result;

  } catch (err) {
    console.error("Error fetching predictive data:", err);
    return generatePredictiveData(homeTeamId, awayTeamId, count);
  }
}


