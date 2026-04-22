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
    // Small range (e.g., Red Cards 0-2): use 0.5 increments
    const lines: number[] = [];
    for (let i = Math.floor(min); i <= max; i++) {
      lines.push(i + 0.5);
    }
    return lines.slice(0, 4);
  }
  
  // Normal range: spread 4 lines across the distribution
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

export default function StatCard({ stat, index }: StatCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isGreenHighlight = stat.highlight === 'green';

  const homeMode = computeMode(stat.homeDist);
  const awayMode = computeMode(stat.awayDist);

  // Merge both distributions to compute smart lines that work for both teams
  const allValues = [...stat.homeDist, ...stat.awayDist];
  const overLines = computeSmartOverLines(allValues);

  return (
    <div
      className={`card transition-all duration-300 ${expanded ? 'card-active' : ''} ${isGreenHighlight ? 'bg-emerald-950/20' : ''}`}
    >
      {/* Collapsed Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className={`text-[11px] font-black uppercase tracking-wider flex-shrink-0 ${isGreenHighlight ? 'text-emerald-400' : 'text-on-surface'}`}>
          {stat.label}
        </span>

        <div className="flex items-center gap-4">
          <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
            {stat.homeMin} — {stat.homeMax}
          </span>
          <span className="text-[11px] font-bold text-blue-400 tabular-nums">
            {stat.awayMin} — {stat.awayMax}
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
          {/* Sublabel */}
          <p className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant/40 pt-3">
            {stat.subLabel}
          </p>

          {/* Range Section */}
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

          {/* Moda Section */}
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

          {/* Over Lines Section */}
          {overLines.length > 0 && (
            <div className="border-t border-outline-variant/50 pt-3">
              <span className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant/40 font-bold">
                Probabilidades
              </span>
              <div className="mt-2 space-y-2.5">
                {overLines.map((line) => {
                  const homePct = computeOverPct(stat.homeDist, line);
                  const awayPct = computeOverPct(stat.awayDist, line);
                  return (
                    <div key={line} className="flex items-center gap-3">
                      <span className="text-[10px] text-on-surface-variant/60 font-bold w-16 flex-shrink-0 tabular-nums">
                        Over {line}
                      </span>
                      <div className="flex-1 space-y-1">
                        {/* Home bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                              style={{ width: `${homePct}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-emerald-400 w-8 text-right tabular-nums">
                            {homePct}%
                          </span>
                        </div>
                        {/* Away bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full transition-all duration-500"
                              style={{ width: `${awayPct}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-blue-400 w-8 text-right tabular-nums">
                            {awayPct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Distribution Section */}
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
