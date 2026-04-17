/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PredictiveStatRow, ToggleMode } from '../types';

interface PredictiveStatsTableProps {
  predictiveStats: PredictiveStatRow[];
  homeTeamName: string;
  awayTeamName: string;
  toggle: ToggleMode;
}

export default function StatsTable({ predictiveStats, homeTeamName, awayTeamName }: PredictiveStatsTableProps) {
  return (
    <div className="bg-surface-container rounded-3xl overflow-hidden border border-outline-variant/30 shadow-2xl">
      {/* Table Header */}
      <div className="grid grid-cols-12 items-center py-5 px-6 border-b border-outline-variant/20 bg-surface-container-highest/30">
        <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60">
          Metric Parameter
        </div>
        
        {/* Home Headers */}
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-[#A855F7]">MIN</div>
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-[#A855F7]">MAX</div>
        <div className="col-span-2 text-center text-[10px] font-bold tracking-widest text-[#A855F7]">DISTRIBUTION</div>
        
        {/* Away Headers */}
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-on-surface-variant/50">MIN</div>
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-on-surface-variant/50">MAX</div>
        <div className="col-span-2 text-center text-[10px] font-bold tracking-widest text-on-surface-variant/50">DISTRIBUTION</div>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {predictiveStats.map((stat, i) => {
          const isGreenHighlight = stat.highlight && stat.highlight === 'green';

          return (
            <div 
              key={i} 
              className={`grid grid-cols-12 items-center py-5 px-6 border-b border-outline-variant/10 last:border-b-0 transition-colors ${
                isGreenHighlight ? 'bg-emerald-500/5' : 'hover:bg-surface-container-highest/10'
              }`}
            >
              {/* Metric Info */}
              <div className="col-span-4 flex flex-col pr-4">
                <span className={`text-sm font-black tracking-wide uppercase ${isGreenHighlight ? 'text-emerald-400' : 'text-on-surface'}`}>
                  {stat.label}
                </span>
                <span className={`text-[9px] uppercase tracking-widest mt-1 ${isGreenHighlight ? 'text-emerald-500/60' : 'text-on-surface-variant/40'}`}>
                  {stat.subLabel}
                </span>
              </div>

              {/* Home Team Stats */}
              <div className="col-span-1 text-center">
                <span className={`text-sm font-bold ${isGreenHighlight ? 'text-emerald-400' : 'text-white'}`}>{stat.homeMin}</span>
              </div>
              <div className="col-span-1 text-center">
                <span className={`text-sm font-bold ${isGreenHighlight ? 'text-emerald-400' : 'text-white'}`}>{stat.homeMax}</span>
              </div>
              <div className="col-span-2 text-center text-[10px] font-mono tracking-widest text-emerald-400/80">
                {stat.homeDist.join(' | ')}
              </div>

              {/* Away Team Stats */}
              <div className="col-span-1 text-center">
                <span className="text-sm font-bold text-on-surface-variant">{stat.awayMin}</span>
              </div>
              <div className="col-span-1 text-center">
                <span className="text-sm font-bold text-on-surface-variant">{stat.awayMax}</span>
              </div>
              <div className="col-span-2 text-center text-[10px] font-mono tracking-widest text-on-surface-variant/40">
                {stat.awayDist.join(' | ')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
