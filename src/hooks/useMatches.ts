/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMatches, fetchLeagues } from '../services/api';
import type { MatchCardData, League } from '../types';

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'LIVE', 'ET', 'BT', 'P']);
const POLL_INTERVAL_MS = 30_000; // 30 seconds

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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Silent refetch — updates data without showing loading spinner
  const silentRefetch = useCallback(async () => {
    try {
      const data = await fetchMatches(
        selectedDate,
        selectedLeagueIds.length > 0 ? selectedLeagueIds : undefined
      );
      setMatches(data);
    } catch {
      // Silent fail — keep current data on screen
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

  // Auto-poll every 30s when there are live matches or NS games starting soon
  useEffect(() => {
    const hasLive = matches.some(m => LIVE_STATUSES.has(m.status));
    const hasUpcoming = matches.some(m => {
      if (m.status !== 'NS') return false;
      const kickoff = new Date(m.date).getTime();
      return kickoff - Date.now() < 30 * 60 * 1000; // starting within 30 min
    });

    if (hasLive || hasUpcoming) {
      pollRef.current = setInterval(silentRefetch, POLL_INTERVAL_MS);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [matches, silentRefetch]);

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
