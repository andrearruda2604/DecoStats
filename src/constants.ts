/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatchCardData, MatchDetailData, League } from './types';

// ─── API-Football League IDs ────────────────────────────────────────

export const LEAGUE_IDS = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  SERIE_A: 135,
  BUNDESLIGA: 78,
  LIGUE_1: 61,
  LIGA_PORTUGAL: 94,
  BRASILEIRAO: 71,
  CHAMPIONS_LEAGUE: 2,
  LIBERTADORES: 13,
  SULAMERICANA: 11,
  EUROPA_LEAGUE: 3,
  CONFERENCE_LEAGUE: 848,
} as const;

// ─── Mock Leagues ───────────────────────────────────────────────────

export const MOCK_LEAGUES: League[] = [
  { id: 1, api_id: 39, name: 'Premier League', country: 'England', country_code: 'GB', logo_url: 'https://media.api-sports.io/football/leagues/39.png', flag_url: 'https://flagcdn.com/w40/gb-eng.png', season: 2025, is_active: true },
  { id: 2, api_id: 140, name: 'La Liga', country: 'Spain', country_code: 'ES', logo_url: 'https://media.api-sports.io/football/leagues/140.png', flag_url: 'https://flagcdn.com/w40/es.png', season: 2025, is_active: true },
  { id: 3, api_id: 135, name: 'Serie A', country: 'Italy', country_code: 'IT', logo_url: 'https://media.api-sports.io/football/leagues/135.png', flag_url: 'https://flagcdn.com/w40/it.png', season: 2025, is_active: true },
  { id: 4, api_id: 78, name: 'Bundesliga', country: 'Germany', country_code: 'DE', logo_url: 'https://media.api-sports.io/football/leagues/78.png', flag_url: 'https://flagcdn.com/w40/de.png', season: 2025, is_active: true },
  { id: 5, api_id: 61, name: 'Ligue 1', country: 'France', country_code: 'FR', logo_url: 'https://media.api-sports.io/football/leagues/61.png', flag_url: 'https://flagcdn.com/w40/fr.png', season: 2025, is_active: true },
  { id: 6, api_id: 94, name: 'Liga Portugal', country: 'Portugal', country_code: 'PT', logo_url: 'https://media.api-sports.io/football/leagues/94.png', flag_url: 'https://flagcdn.com/w40/pt.png', season: 2025, is_active: true },
  { id: 7, api_id: 71, name: 'Brasileirão', country: 'Brazil', country_code: 'BR', logo_url: 'https://media.api-sports.io/football/leagues/71.png', flag_url: 'https://flagcdn.com/w40/br.png', season: 2026, is_active: true },
  { id: 8, api_id: 13, name: 'Copa Libertadores', country: 'South America', country_code: 'SA', logo_url: 'https://media.api-sports.io/football/leagues/13.png', flag_url: '', season: 2026, is_active: true },
  { id: 9, api_id: 11, name: 'Copa Sudamericana', country: 'South America', country_code: 'SA', logo_url: 'https://media.api-sports.io/football/leagues/11.png', flag_url: '', season: 2026, is_active: true },
  { id: 10, api_id: 3, name: 'Europa League', country: 'Europe', country_code: 'EU', logo_url: 'https://media.api-sports.io/football/leagues/3.png', flag_url: '', season: 2026, is_active: true },
  { id: 11, api_id: 848, name: 'Conference League', country: 'Europe', country_code: 'EU', logo_url: 'https://media.api-sports.io/football/leagues/848.png', flag_url: '', season: 2026, is_active: true },
];

// ─── Mock Matches ───────────────────────────────────────────────────

export const MOCK_MATCHES_BY_DATE: MatchCardData[] = [
  {
    id: 1, apiId: 1001234,
    league: { name: 'Premier League', country: 'England', countryCode: 'GB', flagUrl: 'https://flagcdn.com/w40/gb-eng.png', logoUrl: 'https://media.api-sports.io/football/leagues/39.png' },
    time: '13:30', date: '2026-04-17T13:30:00Z', status: 'FT', round: 'Regular Season - 34',
    homeTeam: { id: 1, name: 'Arsenal', logoUrl: 'https://media.api-sports.io/football/teams/42.png', score: 3 },
    awayTeam: { id: 2, name: 'Chelsea', logoUrl: 'https://media.api-sports.io/football/teams/49.png', score: 1 },
  },
  {
    id: 2, apiId: 1001235,
    league: { name: 'Premier League', country: 'England', countryCode: 'GB', flagUrl: 'https://flagcdn.com/w40/gb-eng.png', logoUrl: 'https://media.api-sports.io/football/leagues/39.png' },
    time: '16:00', date: '2026-04-17T16:00:00Z', status: '2H', round: 'Regular Season - 34',
    homeTeam: { id: 3, name: 'Manchester City', logoUrl: 'https://media.api-sports.io/football/teams/50.png', score: 2 },
    awayTeam: { id: 4, name: 'Liverpool', logoUrl: 'https://media.api-sports.io/football/teams/40.png', score: 2 },
  },
  {
    id: 3, apiId: 1001236,
    league: { name: 'La Liga', country: 'Spain', countryCode: 'ES', flagUrl: 'https://flagcdn.com/w40/es.png', logoUrl: 'https://media.api-sports.io/football/leagues/140.png' },
    time: '16:00', date: '2026-04-17T16:00:00Z', status: 'FT', round: 'Regular Season - 32',
    homeTeam: { id: 5, name: 'Real Madrid', logoUrl: 'https://media.api-sports.io/football/teams/541.png', score: 2 },
    awayTeam: { id: 6, name: 'Barcelona', logoUrl: 'https://media.api-sports.io/football/teams/529.png', score: 1 },
  },
  {
    id: 4, apiId: 1001237,
    league: { name: 'La Liga', country: 'Spain', countryCode: 'ES', flagUrl: 'https://flagcdn.com/w40/es.png', logoUrl: 'https://media.api-sports.io/football/leagues/140.png' },
    time: '21:00', date: '2026-04-17T21:00:00Z', status: 'NS', round: 'Regular Season - 32',
    homeTeam: { id: 7, name: 'Atl. Madrid', logoUrl: 'https://media.api-sports.io/football/teams/530.png', score: null },
    awayTeam: { id: 8, name: 'Sevilla', logoUrl: 'https://media.api-sports.io/football/teams/536.png', score: null },
  },
  {
    id: 5, apiId: 1001238,
    league: { name: 'Serie A', country: 'Italy', countryCode: 'IT', flagUrl: 'https://flagcdn.com/w40/it.png', logoUrl: 'https://media.api-sports.io/football/leagues/135.png' },
    time: '14:30', date: '2026-04-17T14:30:00Z', status: 'FT', round: 'Regular Season - 33',
    homeTeam: { id: 9, name: 'Inter', logoUrl: 'https://media.api-sports.io/football/teams/505.png', score: 1 },
    awayTeam: { id: 10, name: 'AC Milan', logoUrl: 'https://media.api-sports.io/football/teams/489.png', score: 0 },
  },
  {
    id: 6, apiId: 1001239,
    league: { name: 'Bundesliga', country: 'Germany', countryCode: 'DE', flagUrl: 'https://flagcdn.com/w40/de.png', logoUrl: 'https://media.api-sports.io/football/leagues/78.png' },
    time: '15:30', date: '2026-04-17T15:30:00Z', status: 'FT', round: 'Regular Season - 30',
    homeTeam: { id: 11, name: 'Bayern Munich', logoUrl: 'https://media.api-sports.io/football/teams/157.png', score: 4 },
    awayTeam: { id: 12, name: 'Dortmund', logoUrl: 'https://media.api-sports.io/football/teams/165.png', score: 2 },
  },
  {
    id: 7, apiId: 1001240,
    league: { name: 'Ligue 1', country: 'France', countryCode: 'FR', flagUrl: 'https://flagcdn.com/w40/fr.png', logoUrl: 'https://media.api-sports.io/football/leagues/61.png' },
    time: '21:00', date: '2026-04-17T21:00:00Z', status: 'NS', round: 'Regular Season - 31',
    homeTeam: { id: 13, name: 'PSG', logoUrl: 'https://media.api-sports.io/football/teams/85.png', score: null },
    awayTeam: { id: 14, name: 'Monaco', logoUrl: 'https://media.api-sports.io/football/teams/91.png', score: null },
  },
  {
    id: 8, apiId: 1001241,
    league: { name: 'Liga Portugal', country: 'Portugal', countryCode: 'PT', flagUrl: 'https://flagcdn.com/w40/pt.png', logoUrl: 'https://media.api-sports.io/football/leagues/94.png' },
    time: '18:00', date: '2026-04-17T18:00:00Z', status: '1H', round: 'Regular Season - 29',
    homeTeam: { id: 15, name: 'Benfica', logoUrl: 'https://media.api-sports.io/football/teams/211.png', score: 1 },
    awayTeam: { id: 16, name: 'Sporting CP', logoUrl: 'https://media.api-sports.io/football/teams/228.png', score: 0 },
  },
];

// ─── Mock Match Detail (Real Madrid vs Barcelona) ───────────────────

export const MOCK_MATCH_DETAIL: MatchDetailData = {
  fixture: {
    id: 3, api_id: 1001236, league_id: 2, home_team_id: 5, away_team_id: 6,
    date: '2026-04-17T16:00:00Z', status: 'FT',
    home_score: 2, away_score: 1, ht_home_score: 1, ht_away_score: 0,
    venue: 'Santiago Bernabéu', round: 'Regular Season - 32', season: 2025,
  },
  homeTeam: { id: 5, api_id: 541, name: 'Real Madrid', short_name: 'RMA', logo_url: 'https://media.api-sports.io/football/teams/541.png', league_id: 2 },
  awayTeam: { id: 6, api_id: 529, name: 'Barcelona', short_name: 'BAR', logo_url: 'https://media.api-sports.io/football/teams/529.png', league_id: 2 },
  league: MOCK_LEAGUES[1],
  stats: {
    FT: [
      { label: 'CHUTES', subLabel: 'TOTAL SHOTS', homeValue: 18, awayValue: 12, type: 'higher-better' },
      { label: 'CHUTES NO GOL', subLabel: 'SHOTS ON TARGET', homeValue: 7, awayValue: 4, type: 'higher-better' },
      { label: 'ESCANTEIOS', subLabel: 'CORNERS', homeValue: 8, awayValue: 5, type: 'higher-better' },
      { label: 'POSSE DE BOLA', subLabel: 'POSSESSION %', homeValue: 42, awayValue: 58, type: 'higher-better' },
      { label: 'CARTÃO AMARELO', subLabel: 'YELLOW CARDS', homeValue: 2, awayValue: 3, type: 'lower-better' },
      { label: 'CARTÃO VERMELHO', subLabel: 'RED CARDS', homeValue: 0, awayValue: 0, type: 'lower-better' },
      { label: 'GOLS', subLabel: 'GOALS SCORED', homeValue: 2, awayValue: 1, type: 'higher-better' },
      { label: 'FALTAS', subLabel: 'FOULS COMMITTED', homeValue: 14, awayValue: 11, type: 'lower-better' },
      { label: 'IMPEDIMENTOS', subLabel: 'OFFSIDES', homeValue: 3, awayValue: 2, type: 'neutral' },
    ],
    HT: [
      { label: 'CHUTES', subLabel: 'TOTAL SHOTS', homeValue: 9, awayValue: 5, type: 'higher-better' },
      { label: 'CHUTES NO GOL', subLabel: 'SHOTS ON TARGET', homeValue: 4, awayValue: 1, type: 'higher-better' },
      { label: 'ESCANTEIOS', subLabel: 'CORNERS', homeValue: 4, awayValue: 2, type: 'higher-better' },
      { label: 'POSSE DE BOLA', subLabel: 'POSSESSION %', homeValue: 38, awayValue: 62, type: 'higher-better' },
      { label: 'CARTÃO AMARELO', subLabel: 'YELLOW CARDS', homeValue: 1, awayValue: 1, type: 'lower-better' },
      { label: 'CARTÃO VERMELHO', subLabel: 'RED CARDS', homeValue: 0, awayValue: 0, type: 'lower-better' },
      { label: 'GOLS', subLabel: 'GOALS SCORED', homeValue: 1, awayValue: 0, type: 'higher-better' },
      { label: 'FALTAS', subLabel: 'FOULS COMMITTED', homeValue: 8, awayValue: 5, type: 'lower-better' },
      { label: 'IMPEDIMENTOS', subLabel: 'OFFSIDES', homeValue: 2, awayValue: 1, type: 'neutral' },
    ],
    '2H': [
      { label: 'CHUTES', subLabel: 'TOTAL SHOTS', homeValue: 9, awayValue: 7, type: 'higher-better' },
      { label: 'CHUTES NO GOL', subLabel: 'SHOTS ON TARGET', homeValue: 3, awayValue: 3, type: 'higher-better' },
      { label: 'ESCANTEIOS', subLabel: 'CORNERS', homeValue: 4, awayValue: 3, type: 'higher-better' },
      { label: 'POSSE DE BOLA', subLabel: 'POSSESSION %', homeValue: 46, awayValue: 54, type: 'higher-better' },
      { label: 'CARTÃO AMARELO', subLabel: 'YELLOW CARDS', homeValue: 1, awayValue: 2, type: 'lower-better' },
      { label: 'CARTÃO VERMELHO', subLabel: 'RED CARDS', homeValue: 0, awayValue: 0, type: 'lower-better' },
      { label: 'GOLS', subLabel: 'GOALS SCORED', homeValue: 1, awayValue: 1, type: 'higher-better' },
      { label: 'FALTAS', subLabel: 'FOULS COMMITTED', homeValue: 6, awayValue: 6, type: 'lower-better' },
      { label: 'IMPEDIMENTOS', subLabel: 'OFFSIDES', homeValue: 1, awayValue: 1, type: 'neutral' },
    ],
  },
  events: [
    { id: 1, fixture_id: 3, team_id: 5, elapsed: 23, extra_time: null, type: 'Goal', detail: 'Normal Goal', player_name: 'Vinícius Jr.', assist_name: 'Bellingham' },
    { id: 2, fixture_id: 3, team_id: 6, elapsed: 34, extra_time: null, type: 'Card', detail: 'Yellow Card', player_name: 'Gavi', assist_name: null },
    { id: 3, fixture_id: 3, team_id: 5, elapsed: 41, extra_time: null, type: 'Card', detail: 'Yellow Card', player_name: 'Tchouaméni', assist_name: null },
    { id: 4, fixture_id: 3, team_id: 6, elapsed: 58, extra_time: null, type: 'Goal', detail: 'Normal Goal', player_name: 'Lewandowski', assist_name: 'Pedri' },
    { id: 5, fixture_id: 3, team_id: 5, elapsed: 72, extra_time: null, type: 'Goal', detail: 'Normal Goal', player_name: 'Bellingham', assist_name: 'Mbappé' },
    { id: 6, fixture_id: 3, team_id: 6, elapsed: 78, extra_time: null, type: 'Card', detail: 'Yellow Card', player_name: 'Araújo', assist_name: null },
    { id: 7, fixture_id: 3, team_id: 5, elapsed: 85, extra_time: null, type: 'Card', detail: 'Yellow Card', player_name: 'Valverde', assist_name: null },
    { id: 8, fixture_id: 3, team_id: 6, elapsed: 88, extra_time: null, type: 'Card', detail: 'Yellow Card', player_name: 'De Jong', assist_name: null },
  ],
};

// ─── Status Labels ──────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, { label: string; color: string; pulse?: boolean }> = {
  'NS': { label: 'Não Iniciado', color: '#666' },
  '1H': { label: '1º Tempo', color: '#4caf50', pulse: true },
  'HT': { label: 'Intervalo', color: '#ff9800' },
  '2H': { label: '2º Tempo', color: '#4caf50', pulse: true },
  'FT': { label: 'Encerrado', color: '#7c4dff' },
  'AET': { label: 'Prorrogação', color: '#7c4dff' },
  'PEN': { label: 'Pênaltis', color: '#7c4dff' },
  'SUSP': { label: 'Suspenso', color: '#ff5252' },
  'PST': { label: 'Adiado', color: '#ff9800' },
  'CANC': { label: 'Cancelado', color: '#ff5252' },
  'ABD': { label: 'Abandonado', color: '#ff5252' },
  'LIVE': { label: 'AO VIVO', color: '#4caf50', pulse: true },
};
