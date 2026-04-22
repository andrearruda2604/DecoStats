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

      {/* Stat Cards */}
      {predictiveStats.map((stat, i) => (
        <StatCard key={i} stat={stat} index={i} show100Only={show100Only} />
      ))}

      {/* Empty state when 100% filter returns nothing */}
      {show100Only && predictiveStats.length > 0 && (
        <div id="no-100-fallback" className="text-center py-8">
          {/* This will only show if ALL StatCards return null */}
        </div>
      )}
    </div>
  );
}
