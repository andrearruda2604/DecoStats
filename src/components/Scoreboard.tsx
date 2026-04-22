/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatchDetailData } from '../types';
import { STATUS_LABELS } from '../constants';

interface ScoreboardProps {
  data: MatchDetailData;
}

export default function Scoreboard({ data }: ScoreboardProps) {
  const { fixture, homeTeam, awayTeam, league } = data;
  const statusConfig = STATUS_LABELS[fixture.status] || STATUS_LABELS['NS'];
  const isLive = statusConfig.pulse;

  return (
    <section className="card overflow-hidden">
      {/* League bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-outline-variant/50">
        <img src={league.flag_url} alt="" className="w-4 h-3 object-cover rounded-sm" />
        <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/50">
          {league.country}
        </span>
        <span className="text-on-surface-variant/20">·</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/60">
          {league.name}
        </span>
      </div>

      {/* Match info — single horizontal row */}
      <div className="flex items-center justify-between px-4 py-5">
        {/* Home Team */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img
            src={homeTeam.logo_url}
            alt={homeTeam.name}
            className="w-10 h-10 object-contain flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-on-surface uppercase truncate">
              {homeTeam.name}
            </h2>
            <span className="text-[8px] uppercase font-bold text-emerald-400/50 tracking-widest">
              Mandante
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center flex-shrink-0 px-4">
          <div className="flex items-baseline gap-3 text-3xl font-black">
            <span className="text-on-surface tabular-nums">{fixture.home_score ?? '–'}</span>
            <span className="text-on-surface-variant/20 font-light text-xl">:</span>
            <span className="text-on-surface tabular-nums">{fixture.away_score ?? '–'}</span>
          </div>

          {fixture.ht_home_score !== null && fixture.ht_away_score !== null && (
            <div className="text-[9px] text-on-surface-variant/30 font-medium mt-0.5 tabular-nums">
              HT {fixture.ht_home_score} – {fixture.ht_away_score}
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full border border-outline-variant bg-surface-container-highest/30">
            {isLive && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusConfig.color }} />
            )}
            <span
              className="text-[8px] font-black uppercase tracking-[0.2em]"
              style={{ color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <h2 className="text-sm font-bold text-on-surface uppercase truncate">
              {awayTeam.name}
            </h2>
            <span className="text-[8px] uppercase font-bold text-blue-400/50 tracking-widest">
              Visitante
            </span>
          </div>
          <img
            src={awayTeam.logo_url}
            alt={awayTeam.name}
            className="w-10 h-10 object-contain flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </div>
    </section>
  );
}
