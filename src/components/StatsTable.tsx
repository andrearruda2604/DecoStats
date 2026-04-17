/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { StatComparison, ToggleMode } from '../types';

interface StatsTableProps {
  stats: StatComparison[];
  homeTeamName: string;
  awayTeamName: string;
  toggle: ToggleMode;
}

function getBarWidth(value: number, otherValue: number): number {
  const total = value + otherValue;
  if (total === 0) return 50;
  return Math.max(15, Math.min(85, (value / total) * 100));
}

function getStatColor(homeVal: number, awayVal: number, type: StatComparison['type'], isHome: boolean): string {
  if (type === 'neutral') return '';
  if (homeVal === awayVal) return '';

  const homeWins = type === 'higher-better' ? homeVal > awayVal : homeVal < awayVal;
  const awayWins = !homeWins;

  if (isHome && homeWins) return 'text-emerald-400';
  if (!isHome && awayWins) return 'text-emerald-400';
  if (isHome && !homeWins) return 'text-red-400/70';
  if (!isHome && !awayWins) return 'text-red-400/70';
  return '';
}

export default function StatsTable({ stats, homeTeamName, awayTeamName, toggle }: StatsTableProps) {
  return (
    <div className="bg-surface-container rounded-3xl overflow-hidden border border-outline-variant shadow-lg">
      {/* Header */}
      <div className="grid grid-cols-12 items-center py-4 px-6 bg-surface-container-highest/10 border-b border-outline-variant/30">
        <div className="col-span-3 text-[10px] font-bold uppercase tracking-widest text-primary truncate">
          {homeTeamName}
        </div>
        <div className="col-span-6 text-center">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-on-surface-variant/40">
            {toggle === 'TOTAL' ? 'Full Time' : toggle === 'HT' ? '1º Tempo' : '2º Tempo'}
          </span>
        </div>
        <div className="col-span-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 truncate">
          {awayTeamName}
        </div>
      </div>

      {/* Stat Rows */}
      <div className="divide-y divide-outline-variant/10">
        {stats.map((stat, idx) => {
          const homeWidth = getBarWidth(stat.homeValue, stat.awayValue);
          const awayWidth = 100 - homeWidth;
          const homeColor = getStatColor(stat.homeValue, stat.awayValue, stat.type, true);
          const awayColor = getStatColor(stat.homeValue, stat.awayValue, stat.type, false);
          const isGoals = stat.label === 'GOLS';

          return (
            <div
              key={idx}
              className={`py-5 px-6 transition-colors hover:bg-surface-container-highest/10 ${
                isGoals ? 'bg-emerald-500/[0.03]' : ''
              }`}
            >
              {/* Values row */}
              <div className="grid grid-cols-12 items-center mb-2">
                <div className="col-span-3">
                  <span className={`text-lg font-black tabular-nums ${homeColor || 'text-on-surface'}`}>
                    {stat.label === 'POSSE DE BOLA' ? `${stat.homeValue}%` : stat.homeValue}
                  </span>
                </div>
                <div className="col-span-6 text-center">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isGoals ? 'text-emerald-400' : 'text-on-surface/80'
                  }`}>
                    {stat.label}
                  </span>
                  <div className="text-[8px] text-on-surface-variant/30 uppercase tracking-widest mt-0.5">
                    {stat.subLabel}
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <span className={`text-lg font-black tabular-nums ${awayColor || 'text-on-surface-variant/70'}`}>
                    {stat.label === 'POSSE DE BOLA' ? `${stat.awayValue}%` : stat.awayValue}
                  </span>
                </div>
              </div>

              {/* Bar visualization */}
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`rounded-full transition-all duration-700 ease-out ${
                    homeColor === 'text-emerald-400' ? 'bg-emerald-500/60' : 
                    homeColor === 'text-red-400/70' ? 'bg-red-500/30' : 'bg-primary/40'
                  }`}
                  style={{ width: `${homeWidth}%` }}
                />
                <div
                  className={`rounded-full transition-all duration-700 ease-out ${
                    awayColor === 'text-emerald-400' ? 'bg-emerald-500/60' : 
                    awayColor === 'text-red-400/70' ? 'bg-red-500/30' : 'bg-on-surface-variant/15'
                  }`}
                  style={{ width: `${awayWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
