/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchMatches, fetchLeagues } from '../services/api';
import type { MatchCardData, League } from '../types';

interface UseMatchesReturn {
  matches: MatchCardData[];
  leagues: League[];
  loading: boolean;
  error: string | null;
  selectedDate: string;
  selectedLeagueIds: number[];
  setSelectedDate: (date: string) => void;
  setSelectedLeagueIds: (ids: number[]) => void;
  refresh: () => void;
}

function getToday(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function useMatches(): UseMatchesReturn {
  const [matches, setMatches] = useState<MatchCardData[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<number[]>([]);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMatches(
        selectedDate,
        selectedLeagueIds.length > 0 ? selectedLeagueIds : undefined
      );
      setMatches(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar partidas');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedLeagueIds]);

  const loadLeagues = useCallback(async () => {
    try {
      const data = await fetchLeagues();
      setLeagues(data as League[]);
    } catch {
      // Silently fail, leagues are not critical
    }
  }, []);

  useEffect(() => { loadLeagues(); }, [loadLeagues]);
  useEffect(() => { loadMatches(); }, [loadMatches]);

  return {
    matches,
    leagues,
    loading,
    error,
    selectedDate,
    selectedLeagueIds,
    setSelectedDate,
    setSelectedLeagueIds,
    refresh: loadMatches,
  };
}
