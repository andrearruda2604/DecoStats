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
      {/* Table Header - Desktop Only */}
      <div className="hidden md:grid grid-cols-12 items-center py-5 px-6 border-b border-outline-variant/20 bg-surface-container-highest/30">
        <div className="col-span-4 text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60">
          PARÂMETRO DE MÉTRICA
        </div>
        
        {/* Home Headers */}
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-[#A855F7]">MÍN</div>
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-[#A855F7]">MÁX</div>
        <div className="col-span-2 text-center text-[10px] font-bold tracking-widest text-emerald-400/60">DISTRIBUIÇÃO</div>
        
        {/* Away Headers */}
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-blue-400/50">MÍN</div>
        <div className="col-span-1 text-center text-[10px] font-bold tracking-widest text-blue-400/50">MÁX</div>
        <div className="col-span-2 text-center text-[10px] font-bold tracking-widest text-blue-400/50">DISTRIBUIÇÃO</div>
      </div>

      {/* Mobile Header (Simplified) */}
      <div className="md:hidden flex justify-between items-center py-4 px-6 border-b border-outline-variant/20 bg-surface-container-highest/30">
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Métrica</span>
        <div className="flex gap-8">
          <span className="text-[10px] font-bold text-emerald-400/60 uppercase">Mandante</span>
          <span className="text-[10px] font-bold text-blue-400/60 uppercase">Visitante</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {predictiveStats.map((stat, i) => {
          const isGreenHighlight = stat.highlight && stat.highlight === 'green';

          return (
            <div 
              key={i} 
              className={`flex flex-col md:grid md:grid-cols-12 items-center py-4 md:py-5 px-6 border-b border-outline-variant/10 last:border-b-0 transition-colors ${
                isGreenHighlight ? 'bg-emerald-500/5' : 'hover:bg-surface-container-highest/10'
              }`}
            >
              {/* Metric Title & Range Info */}
              <div className="md:col-span-4 flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start w-full mb-3 md:mb-0">
                <div className="flex flex-col">
                  <span className={`text-[11px] md:text-sm font-black tracking-wide uppercase ${isGreenHighlight ? 'text-emerald-400' : 'text-on-surface'}`}>
                    {stat.label}
                  </span>
                  <span className={`hidden md:block text-[9px] uppercase tracking-widest mt-1 ${isGreenHighlight ? 'text-emerald-500/60' : 'text-on-surface-variant/40'}`}>
                    {stat.subLabel}
                  </span>
                </div>
                
                {/* Mobile-only Ranges */}
                <div className="md:hidden flex gap-4 text-[11px] font-bold">
                  <span className="text-emerald-400">{stat.homeMin}-{stat.homeMax}</span>
                  <span className="text-blue-400">{stat.awayMin}-{stat.awayMax}</span>
                </div>
              </div>

              {/* Data Blocks (Desktop Grid / Mobile Flex) */}
              <div className="md:contents flex justify-between items-center w-full gap-4">
                {/* Home Stats (Emerald) */}
                <div className="hidden md:block col-span-1 text-center">
                  <span className={`text-sm font-bold ${isGreenHighlight ? 'text-emerald-400' : 'text-white'}`}>{stat.homeMin}</span>
                </div>
                <div className="hidden md:block col-span-1 text-center">
                  <span className={`text-sm font-bold ${isGreenHighlight ? 'text-emerald-400' : 'text-white'}`}>{stat.homeMax}</span>
                </div>
                <div className="md:col-span-2 flex-1 md:flex-none text-left md:text-center text-[10px] font-mono tracking-widest text-emerald-400/80 bg-emerald-500/5 md:bg-transparent px-2 py-1 rounded md:p-0">
                  {stat.homeDist.join(' | ')}
                </div>

                {/* Away Stats (Blue) */}
                <div className="hidden md:block col-span-1 text-center">
                  <span className="text-sm font-bold text-blue-100">{stat.awayMin}</span>
                </div>
                <div className="hidden md:block col-span-1 text-center">
                  <span className="text-sm font-bold text-blue-100">{stat.awayMax}</span>
                </div>
                <div className="md:col-span-2 flex-1 md:flex-none text-right md:text-center text-[10px] font-mono tracking-widest text-blue-400/80 bg-blue-500/5 md:bg-transparent px-2 py-1 rounded md:p-0">
                  {stat.awayDist.join(' | ')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
