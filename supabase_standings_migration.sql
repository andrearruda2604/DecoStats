-- Run this in the Supabase SQL Editor
-- Creates the standings table for league classification data

CREATE TABLE IF NOT EXISTS standings (
  id              BIGSERIAL PRIMARY KEY,
  league_id       INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season          INTEGER NOT NULL,
  "group"         TEXT    NOT NULL DEFAULT '',
  rank            INTEGER NOT NULL,
  team_api_id     INTEGER NOT NULL,
  team_name       TEXT    NOT NULL,
  team_logo       TEXT    NOT NULL DEFAULT '',
  points          INTEGER NOT NULL DEFAULT 0,
  played          INTEGER NOT NULL DEFAULT 0,
  won             INTEGER NOT NULL DEFAULT 0,
  drawn           INTEGER NOT NULL DEFAULT 0,
  lost            INTEGER NOT NULL DEFAULT 0,
  goals_for       INTEGER NOT NULL DEFAULT 0,
  goals_against   INTEGER NOT NULL DEFAULT 0,
  goal_diff       INTEGER NOT NULL DEFAULT 0,
  form            TEXT    NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (league_id, season, "group", rank)
);

CREATE INDEX IF NOT EXISTS idx_standings_league_season ON standings (league_id, season);

-- Enable Row Level Security (read-only for authenticated users)
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "standings_read" ON standings
  FOR SELECT USING (true);
