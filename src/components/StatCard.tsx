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
  homeTeamName?: string;
  awayTeamName?: string;
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

export default function StatCard({ stat, index, show100Only = false, homeTeamName = 'Mandante', awayTeamName = 'Visitante' }: StatCardProps) {
  const homeShort = homeTeamName.length > 12 ? homeTeamName.slice(0, 3).toUpperCase() : homeTeamName;
  const awayShort = awayTeamName.length > 12 ? awayTeamName.slice(0, 3).toUpperCase() : awayTeamName;
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
          <div className={`w-14 text-center py-1 rounded font-bold text-[10px] tabular-nums ${stat.homeMax > stat.awayMax ? 'bg-primary text-white' : 'bg-surface-elevated text-on-surface-variant'}`}>
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
          
          <div className={`w-14 text-center py-1 rounded font-bold text-[10px] tabular-nums ${stat.awayMax > stat.homeMax ? 'bg-blue-600 text-white' : 'bg-surface-elevated text-on-surface-variant'}`}>
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
          <p className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/70 pt-3 font-bold">
            {stat.subLabel}
          </p>

          {/* Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[8px] uppercase tracking-widest text-emerald-400/60 font-bold">Mandante</span>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-center">
                  <span className="text-2xl font-black text-emerald-400 tabular-nums">{stat.homeMin}</span>
                  <span className="block text-[7px] font-black uppercase tracking-widest text-emerald-400/40">Min</span>
                </div>
                <span className="text-lg font-black text-emerald-400/30">—</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-emerald-400 tabular-nums">{stat.homeMax}</span>
                  <span className="block text-[7px] font-black uppercase tracking-widest text-emerald-400/40">Max</span>
                </div>
              </div>
            </div>
            <div>
              <span className="text-[8px] uppercase tracking-widest text-blue-400/60 font-bold">Visitante</span>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-center">
                  <span className="text-2xl font-black text-blue-400 tabular-nums">{stat.awayMin}</span>
                  <span className="block text-[7px] font-black uppercase tracking-widest text-blue-400/40">Min</span>
                </div>
                <span className="text-lg font-black text-blue-400/30">—</span>
                <div className="text-center">
                  <span className="text-2xl font-black text-blue-400 tabular-nums">{stat.awayMax}</span>
                  <span className="block text-[7px] font-black uppercase tracking-widest text-blue-400/40">Max</span>
                </div>
              </div>
            </div>
          </div>

          {/* Moda */}
          <div className="border-t border-outline-variant/50 pt-3">
            <span className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/70 font-bold">
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

          {/* Probabilidades (Layout Espelhado) */}
          {displayRows.length > 0 && (
            <div className="border-t border-outline-variant/50 pt-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-black">
                  Probabilidades
                </span>
                <div className="flex items-center gap-3 text-[8px] font-bold text-on-surface-variant/60">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-400 inline-block" /> Mais</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> Menos</span>
                </div>
              </div>

              {/* Column headers */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="flex-1 flex justify-between text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">
                  <span>Menos</span>
                  <span>Mais</span>
                </div>
                <div className="w-12 shrink-0" />
                <div className="flex-1 flex justify-between text-[8px] font-black uppercase tracking-widest text-on-surface-variant/60">
                  <span>Mais</span>
                  <span>Menos</span>
                </div>
              </div>

              {/* Team name row */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="flex-1 text-[9px] font-black text-on-surface-variant/60 text-center truncate">{homeShort}</span>
                <div className="w-12 shrink-0" />
                <span className="flex-1 text-[9px] font-black text-on-surface-variant/60 text-center truncate">{awayShort}</span>
              </div>

              {/* Rows */}
              <div className="space-y-2">
                {displayRows.map(({ line, homeOver, awayOver, homeUnder, awayUnder }) => {
                  const totalH = stat.homeDist.length;
                  const totalA = stat.awayDist.length;
                  const hOverC = Math.round(homeOver * totalH / 100);
                  const aOverC = Math.round(awayOver * totalA / 100);
                  const anyIs100 = homeOver === 100 || awayOver === 100 || homeUnder === 100 || awayUnder === 100;

                  return (
                    <div key={line} className={`flex items-center gap-2 rounded-lg px-1 py-1.5 ${anyIs100 ? 'bg-amber-400/5' : ''}`}>
                      
                      {/* ── HOME BAR (mirrored: Under left ← → Over right) ── */}
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center h-7 rounded overflow-hidden bg-surface-container-highest/30">
                          {/* Under (red, left side) */}
                          {homeUnder > 0 && (
                            <div
                              className="h-full bg-amber-500 flex items-center justify-center transition-all duration-500"
                              style={{ width: `${homeUnder}%` }}
                            >
                              {homeUnder > 6 && (
                                <span className="text-[10px] font-black text-white tabular-nums px-1">{homeUnder}%</span>
                              )}
                            </div>
                          )}
                          {/* Over (green, right side) */}
                          {homeOver > 0 && (
                            <div
                              className="h-full bg-cyan-400 flex items-center justify-center transition-all duration-500"
                              style={{ width: `${homeOver}%` }}
                            >
                              {homeOver > 6 && (
                                <span className="text-[10px] font-black text-white tabular-nums px-1 truncate">
                                  {homeOver}%
                                  <span className="opacity-60 font-medium text-[8px] ml-0.5">({hOverC}/{totalH})</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── CENTER: Line number ── */}
                      <div className={`w-12 shrink-0 flex items-center justify-center rounded-md py-1 ${anyIs100 ? 'bg-amber-400/15 border border-amber-400/30' : 'bg-surface-container border border-outline-variant/15'}`}>
                        <span className={`text-[11px] font-black tabular-nums ${anyIs100 ? 'text-amber-400' : 'text-on-surface'}`}>
                          {line}
                        </span>
                      </div>

                      {/* ── AWAY BAR (normal: Over left → Under right) ── */}
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center h-7 rounded overflow-hidden bg-surface-container-highest/30">
                          {/* Over (green, left side) */}
                          {awayOver > 0 && (
                            <div
                              className="h-full bg-cyan-400 flex items-center justify-center transition-all duration-500"
                              style={{ width: `${awayOver}%` }}
                            >
                              {awayOver > 6 && (
                                <span className="text-[10px] font-black text-white tabular-nums px-1 truncate">
                                  {awayOver}%
                                  <span className="opacity-60 font-medium text-[8px] ml-0.5">({aOverC}/{totalA})</span>
                                </span>
                              )}
                            </div>
                          )}
                          {/* Under (red, right side) */}
                          {awayUnder > 0 && (
                            <div
                              className="h-full bg-amber-500 flex items-center justify-center transition-all duration-500"
                              style={{ width: `${awayUnder}%` }}
                            >
                              {awayUnder > 6 && (
                                <span className="text-[10px] font-black text-white tabular-nums px-1">{awayUnder}%</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Distribution */}
          <div className="border-t border-outline-variant/50 pt-3">
            <span className="text-[9px] uppercase tracking-[0.2em] text-on-surface-variant/70 font-bold">
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
