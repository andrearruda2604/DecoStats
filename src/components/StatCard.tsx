/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PredictiveStatRow } from '../types';

interface StatCardProps {
  stat: PredictiveStatRow;
  index: number;
  show100Only?: boolean;
}

function computeMode(dist: number[]): { value: number; count: number } {
  if (dist.length === 0) return { value: 0, count: 0 };
  const freq: Record<number, number> = {};
  for (const v of dist) {
    freq[v] = (freq[v] || 0) + 1;
  }
  let maxVal = dist[0], maxCount = 1;
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxCount) {
      maxCount = count;
      maxVal = Number(val);
    }
  }
  return { value: maxVal, count: maxCount };
}

function computeSmartOverLines(dist: number[]): number[] {
  if (dist.length === 0) return [];
  const min = Math.min(...dist);
  const max = Math.max(...dist);
  const range = max - min;
  
  // Aumentamos para 8 linhas para dar mais visão de mercado
  if (range <= 6) {
    const lines: number[] = [];
    for (let i = Math.floor(min); i <= max; i++) {
        lines.push(i + 0.5);
    }
    return lines.slice(0, 8);
  }
  
  // Cálculo mais denso para capturar valores como 11.5, 12.5 etc
  const step = Math.max(1, Math.round(range / 10));
  const lines: number[] = [];
  for (let i = Math.floor(min); lines.length < 8 && i + 0.5 < max; i += step) {
    lines.push(i + 0.5);
  }
  return lines;
}

function computeOverPct(dist: number[], threshold: number): number {
  if (dist.length === 0) return 0;
  const count = dist.filter(v => v > threshold).length;
  return Math.round((count / dist.length) * 100);
}

function computeUnderPct(dist: number[], threshold: number): number {
  if (dist.length === 0) return 0;
  const count = dist.filter(v => v < threshold).length;
  return Math.round((count / dist.length) * 100);
}

export default function StatCard({ stat, index, show100Only = false }: StatCardProps) {
  const [expanded, setExpanded] = useState(false);

  const homeMode = computeMode(stat.homeDist);
  const awayMode = computeMode(stat.awayDist);

  const allValues = [...stat.homeDist, ...stat.awayDist];
  const overLines = computeSmartOverLines(allValues);

  // Build the probability rows with Over + Under
  const probRows = overLines.map((line) => {
    const homeOver = computeOverPct(stat.homeDist, line);
    const awayOver = computeOverPct(stat.awayDist, line);
    const homeUnder = computeUnderPct(stat.homeDist, line);
    const awayUnder = computeUnderPct(stat.awayDist, line);
    return { line, homeOver, awayOver, homeUnder, awayUnder };
  });

  // If 100% filter is active, check if this card has ANY 100% line
  const has100 = probRows.some(r =>
    r.homeOver === 100 || r.awayOver === 100 || r.homeUnder === 100 || r.awayUnder === 100
  );

  // In 100% mode, hide cards with no 100% lines
  if (show100Only && !has100) return null;

  // In 100% mode, filter only rows that have at least one 100%
  const displayRows = show100Only
    ? probRows.filter(r => r.homeOver === 100 || r.awayOver === 100 || r.homeUnder === 100 || r.awayUnder === 100)
    : probRows;

  const homeAvg = stat.homeDist.length ? stat.homeDist.reduce((a, b) => a + b, 0) / stat.homeDist.length : 0;
  const awayAvg = stat.awayDist.length ? stat.awayDist.reduce((a, b) => a + b, 0) / stat.awayDist.length : 0;

  return (
    <div className={`card transition-all duration-300 ${expanded ? 'card-active' : ''}`}>
      {/* Collapsed Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-surface rounded-xl border border-white/5 hover:bg-white/5 transition-colors relative">
          <div className={`w-14 text-center py-1 rounded font-bold text-[10px] tabular-nums ${homeAvg > awayAvg ? 'bg-primary text-white' : 'bg-surface-elevated text-on-surface-variant'}`}>
            {stat.homeMin}-{stat.homeMax}
          </div>
          
          <div className="flex-1 flex flex-col items-center min-w-0 z-10">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-on-surface truncate">
                {stat.label}
              </span>
              {has100 && (
                <span className="text-[8px] font-black text-amber-400 tracking-wider">
                  100%
                </span>
              )}
            </div>
            {expanded && (
               <ChevronUp className="w-3 h-3 text-primary mt-0.5" />
            )}
          </div>
          
          <div className={`w-14 text-center py-1 rounded font-bold text-[10px] tabular-nums ${awayAvg > homeAvg ? 'bg-blue-600 text-white' : 'bg-surface-elevated text-on-surface-variant'}`}>
            {stat.awayMin}-{stat.awayMax}
          </div>
          
          {!expanded && (
            <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
              <ChevronDown className="w-3 h-3 text-on-surface-variant/30" />
            </div>
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="card-expand border-t border-outline-variant px-4 pb-4 space-y-4">
          <p className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant/40 pt-3">
            {stat.subLabel}
          </p>

          {/* Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] uppercase tracking-widest text-emerald-400/60 font-bold">Mandante</span>
              <p className="text-lg font-black text-emerald-400 tabular-nums mt-0.5">
                {stat.homeMin} — {stat.homeMax}
              </p>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-widest text-blue-400/60 font-bold">Visitante</span>
              <p className="text-lg font-black text-blue-400 tabular-nums mt-0.5">
                {stat.awayMin} — {stat.awayMax}
              </p>
            </div>
          </div>

          {/* Moda */}
          <div className="border-t border-outline-variant/50 pt-3">
            <span className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant/40 font-bold">
              Mais Frequente
            </span>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400 tabular-nums">{homeMode.value}</span>
                <span className="text-[9px] text-emerald-400/50">{homeMode.count}x em {stat.homeDist.length} jogos</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-400 tabular-nums">{awayMode.value}</span>
                <span className="text-[9px] text-blue-400/50">{awayMode.count}x em {stat.awayDist.length} jogos</span>
              </div>
            </div>
          </div>

          {/* Probabilidades (Over + Under Compacto) */}
          {displayRows.length > 0 && (
            <div className="border-t border-outline-variant/50 pt-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-black block mb-4">
                Probabilidades
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {[
                  displayRows.slice(0, Math.ceil(displayRows.length / 2)),
                  displayRows.slice(Math.ceil(displayRows.length / 2))
                ].map((column, colIdx) => (
                  <div key={colIdx} className="space-y-4">
                    {column.map(({ line, homeOver, awayOver, homeUnder, awayUnder }) => {
                      const totalH = stat.homeDist.length;
                      const totalA = stat.awayDist.length;
                      const hOverC = Math.round(homeOver * totalH / 100);
                      const hUnderC = Math.round(homeUnder * totalH / 100);
                      const aOverC = Math.round(awayOver * totalA / 100);
                      const aUnderC = Math.round(awayUnder * totalA / 100);

                      return (
                        <div key={line} className="bg-surface/20 rounded-xl p-3 border border-outline-variant/5">
                          {/* Header Linha */}
                          <div className="flex items-center justify-center mb-3 relative">
                            <div className="absolute left-0 right-0 h-px bg-outline-variant/10" />
                            <span className="relative bg-surface-container-low px-2 text-[10px] font-black uppercase tracking-widest text-on-surface shadow-sm rounded-md border border-outline-variant/10">
                              Linha {line}
                            </span>
                          </div>

                          {/* Home Row */}
                          <div className="mb-3">
                            <div className="flex justify-between items-end mb-1">
                              <span className={`text-[9px] font-black ${homeOver === 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                MAIS: {homeOver}% <span className="opacity-50 font-medium">({hOverC}/{totalH})</span>
                              </span>
                              <span className="text-[9px] font-black text-on-surface-variant/70">
                                <span className="opacity-50 font-medium">({hUnderC}/{totalH})</span> {homeUnder}% :MENOS
                              </span>
                            </div>
                            <div className="w-full h-2 flex rounded-sm overflow-hidden bg-surface-container-highest">
                              <div 
                                className={`h-full transition-all duration-500 shadow-[0_0_8px] ${homeOver === 100 ? 'bg-amber-400 shadow-amber-400/50' : 'bg-emerald-400 shadow-emerald-400/30'}`} 
                                style={{ width: `${homeOver}%` }} 
                              />
                            </div>
                          </div>

                          {/* Away Row */}
                          <div>
                            <div className="flex justify-between items-end mb-1">
                              <span className={`text-[9px] font-black ${awayOver === 100 ? 'text-amber-400' : 'text-blue-400'}`}>
                                MAIS: {awayOver}% <span className="opacity-50 font-medium">({aOverC}/{totalA})</span>
                              </span>
                              <span className="text-[9px] font-black text-on-surface-variant/70">
                                <span className="opacity-50 font-medium">({aUnderC}/{totalA})</span> {awayUnder}% :MENOS
                              </span>
                            </div>
                            <div className="w-full h-2 flex rounded-sm overflow-hidden bg-surface-container-highest">
                              <div 
                                className={`h-full transition-all duration-500 shadow-[0_0_8px] ${awayOver === 100 ? 'bg-amber-400 shadow-amber-400/50' : 'bg-blue-400 shadow-blue-400/50'}`} 
                                style={{ width: `${awayOver}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distribution */}
          <div className="border-t border-outline-variant/50 pt-3">
            <span className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant/40 font-bold">
              Distribuição
            </span>
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-mono tracking-wider text-emerald-400/70 leading-relaxed">
                {stat.homeDist.join(' | ')}
              </p>
              <p className="text-[10px] font-mono tracking-wider text-blue-400/70 leading-relaxed">
                {stat.awayDist.join(' | ')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
