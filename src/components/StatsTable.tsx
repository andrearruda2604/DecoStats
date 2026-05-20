/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PredictiveStatRow, ToggleMode } from '../types';
import StatCard from './StatCard';

interface PredictiveStatsTableProps {
  predictiveStats: PredictiveStatRow[];
  homeTeamName: string;
  awayTeamName: string;
  toggle: ToggleMode;
  show100Only?: boolean;
}

export default function StatsTable({ predictiveStats, homeTeamName, awayTeamName, show100Only = false }: PredictiveStatsTableProps) {
  const hasNoData = predictiveStats.length > 0 &&
    predictiveStats[0].homeDist.length === 0 &&
    predictiveStats[0].awayDist.length === 0;

  return (
    <div className="space-y-2">
      {/* Team legend */}
      <div className="flex items-center justify-end gap-6 px-4 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
            {homeTeamName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
            {awayTeamName}
          </span>
        </div>
      </div>

      {/* Stat Cards or Warning */}
      {hasNoData ? (
        <div className="text-center py-14 px-6 border border-outline-variant/10 rounded-2xl bg-surface/10 space-y-3">
          <p className="text-[12px] font-black text-amber-400 uppercase tracking-widest">
            Sem histórico nesta competição
          </p>
          <p className="text-[10px] text-on-surface-variant/60 max-w-sm mx-auto leading-relaxed">
            Os times não possuem partidas registradas na liga do jogo selecionada.
            Experimente mudar o filtro de Ligas para <strong className="text-primary font-black">"Todas"</strong> no topo para ver o histórico geral das equipes.
          </p>
        </div>
      ) : (
        predictiveStats.map((stat, i) => (
          <StatCard key={i} stat={stat} index={i} show100Only={show100Only} homeTeamName={homeTeamName} awayTeamName={awayTeamName} />
        ))
      )}

      {/* Empty state when 100% filter returns nothing */}
      {show100Only && !hasNoData && predictiveStats.length > 0 && (
        <div id="no-100-fallback" className="text-center py-8">
          {/* This will only show if ALL StatCards return null */}
        </div>
      )}
    </div>
  );
}
