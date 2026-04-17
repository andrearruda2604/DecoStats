/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchMatchDetail } from '../services/api';
import type { MatchDetailData, ToggleMode } from '../types';

interface UseMatchStatsReturn {
  data: MatchDetailData | null;
  loading: boolean;
  error: string | null;
  toggle: ToggleMode;
  setToggle: (mode: ToggleMode) => void;
  refresh: () => void;
}

export function useMatchStats(fixtureId: number | null): UseMatchStatsReturn {
  const [data, setData] = useState<MatchDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggle, setToggle] = useState<ToggleMode>('TOTAL');

  const loadDetail = useCallback(async () => {
    if (!fixtureId) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchMatchDetail(fixtureId);
      setData(detail);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar detalhes da partida');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return {
    data,
    loading,
    error,
    toggle,
    setToggle,
    refresh: loadDetail,
  };
}
