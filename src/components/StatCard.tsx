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
  
  if (range <= 3) {
    const lines: number[] = [];
    for (let i = Math.floor(min); i <= max; i++) {
      lines.push(i + 0.5);
    }
    return lines.slice(0, 4);
  }
  
  const step = Math.max(1, Math.round(range / 5));
  const lines: number[] = [];
  for (let i = Math.floor(min); lines.length < 4 && i + 0.5 < max; i += step) {
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

  return (
    <div className={`card transition-all duration-300 ${expanded ? 'card-active' : ''}`}>
      {/* Collapsed Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <span className="text-[11px] font-black uppercase tracking-wider text-on-surface truncate">
            {stat.label}
          </span>
          {has100 && (
            <span className="text-[8px] font-black bg-amber-400/20 text-amber-400 px-1.5 py-0.5 rounded tracking-wider flex-shrink-0">
              100%
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
            {stat.homeMin}—{stat.homeMax}
          </span>
          <span className="text-[11px] font-bold text-blue-400 tabular-nums">
            {stat.awayMin}—{stat.awayMax}
          </span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant/40 flex-shrink-0" />
          }
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

          {/* Probabilidades (Over + Under) */}
          {displayRows.length > 0 && (
            <div className="border-t border-outline-variant/50 pt-3">
              <span className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant/40 font-bold">
                Probabilidades
              </span>
              <div className="mt-2 space-y-3">
                {displayRows.map(({ line, homeOver, awayOver, homeUnder, awayUnder }) => (
                  <div key={line} className="space-y-1.5">
                    {/* Over line */}
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-on-surface-variant/60 font-bold w-16 flex-shrink-0 tabular-nums">
                        Over {line}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${homeOver === 100 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${homeOver}%` }} />
                          </div>
                          <span className={`text-[9px] font-bold w-8 text-right tabular-nums ${homeOver === 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {homeOver}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${awayOver === 100 ? 'bg-amber-400' : 'bg-blue-400'}`} style={{ width: `${awayOver}%` }} />
                          </div>
                          <span className={`text-[9px] font-bold w-8 text-right tabular-nums ${awayOver === 100 ? 'text-amber-400' : 'text-blue-400'}`}>
                            {awayOver}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Under line */}
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-on-surface-variant/40 font-bold w-16 flex-shrink-0 tabular-nums">
                        Under {line}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${homeUnder === 100 ? 'bg-amber-400' : 'bg-emerald-400/50'}`} style={{ width: `${homeUnder}%` }} />
                          </div>
                          <span className={`text-[8px] font-bold w-8 text-right tabular-nums ${homeUnder === 100 ? 'text-amber-400' : 'text-emerald-400/50'}`}>
                            {homeUnder}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${awayUnder === 100 ? 'bg-amber-400' : 'bg-blue-400/50'}`} style={{ width: `${awayUnder}%` }} />
                          </div>
                          <span className={`text-[8px] font-bold w-8 text-right tabular-nums ${awayUnder === 100 ? 'text-amber-400' : 'text-blue-400/50'}`}>
                            {awayUnder}%
                          </span>
                        </div>
                      </div>
                    </div>
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
