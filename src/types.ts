/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ─── Database Models ────────────────────────────────────────────────

export interface League {
  id: number;
  api_id: number;
  name: string;
  country: string;
  country_code: string;
  logo_url: string;
  flag_url: string;
  season: number;
  is_active: boolean;
}

export interface Team {
  id: number;
  api_id: number;
  name: string;
  short_name: string;
  logo_url: string;
  league_id: number;
}

export interface Fixture {
  id: number;
  api_id: number;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  date: string;
  status: FixtureStatus;
  home_score: number | null;
  away_score: number | null;
  ht_home_score: number | null;
  ht_away_score: number | null;
  venue: string;
  round: string;
  season: number;
  // Joined
  league?: League;
  home_team?: Team;
  away_team?: Team;
}

export type FixtureStatus = 'NS' | '1H' | 'HT' | '2H' | 'FT' | 'AET' | 'PEN' | 'SUSP' | 'PST' | 'CANC' | 'ABD' | 'LIVE';

export type StatPeriod = 'FT' | 'HT' | '2H';

export interface FixtureStats {
  id: number;
  fixture_id: number;
  team_id: number;
  period: StatPeriod;
  shots_total: number;
  shots_on_goal: number;
  shots_off_goal: number;
  corners: number;
  yellow_cards: number;
  red_cards: number;
  goals: number;
  possession: number;
  fouls: number;
  offsides: number;
}

export interface FixtureEvent {
  id: number;
  fixture_id: number;
  team_id: number;
  elapsed: number;
  extra_time: number | null;
  type: 'Goal' | 'Card' | 'Subst' | 'Var';
  detail: string;
  player_name: string;
  assist_name: string | null;
}

// ─── UI / View Models ──────────────────────────────────────────────

export interface MatchCardData {
  id: number;
  apiId: number;
  league: {
    name: string;
    country: string;
    countryCode: string;
    flagUrl: string;
    logoUrl: string;
  };
  time: string;
  date: string;
  status: FixtureStatus;
  homeTeam: {
    id: number;
    name: string;
    logoUrl: string;
    score: number | null;
  };
  awayTeam: {
    id: number;
    name: string;
    logoUrl: string;
    score: number | null;
  };
  round: string;
}

export type ToggleMode = 'HT' | 'FT' | 'TOTAL';

export interface StatComparison {
  label: string;
  subLabel: string;
  homeValue: number;
  awayValue: number;
  type: 'higher-better' | 'lower-better' | 'neutral';
}

export interface MatchDetailData {
  fixture: Fixture;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  stats: {
    FT: StatComparison[];
    HT: StatComparison[];
    '2H': StatComparison[];
  };
  events: FixtureEvent[];
}
