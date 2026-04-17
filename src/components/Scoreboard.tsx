/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatchDetailData } from '../types';
import { STATUS_LABELS } from '../constants';
import { BarChart3, MapPin } from 'lucide-react';

interface ScoreboardProps {
  data: MatchDetailData;
}

export default function Scoreboard({ data }: ScoreboardProps) {
  const { fixture, homeTeam, awayTeam, league } = data;
  const statusConfig = STATUS_LABELS[fixture.status] || STATUS_LABELS['NS'];
  const isLive = statusConfig.pulse;

  return (
    <section className="mb-6 relative overflow-hidden rounded-3xl border border-outline-variant bg-gradient-to-br from-surface-container via-surface-container to-surface-container-low group hover:border-outline/50 transition-colors">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
        <BarChart3 size={160} className="text-primary" />
      </div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/[0.02] rounded-full -translate-x-1/2 translate-y-1/2" />

      {/* League bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-surface-container-highest/10 border-b border-outline-variant/20">
        <img src={league.flag_url} alt="" className="w-4 h-3 object-cover rounded-sm" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50">
          {league.country}
        </span>
        <span className="text-on-surface-variant/10">•</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/60">
          {league.name}
        </span>
        {fixture.venue && (
          <>
            <span className="text-on-surface-variant/10 ml-auto hidden md:inline">•</span>
            <MapPin className="w-3 h-3 text-on-surface-variant/30 hidden md:inline" />
            <span className="text-[9px] text-on-surface-variant/30 hidden md:inline">{fixture.venue}</span>
          </>
        )}
      </div>

      <div className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          {/* Home Team */}
          <div className="flex items-center gap-5 text-center md:text-left">
            <div className="w-18 h-18 flex items-center justify-center">
              <img
                src={homeTeam.logo_url}
                alt={homeTeam.name}
                className="w-16 h-16 object-contain drop-shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).alt = homeTeam.short_name;
                }}
              />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight text-on-surface uppercase">
                {homeTeam.name}
              </h2>
              <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest">
                Mandante
              </span>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-5 text-6xl font-black">
              <span className="text-on-surface tabular-nums">{fixture.home_score ?? '-'}</span>
              <span className="text-on-surface-variant/15 font-light text-4xl">:</span>
              <span className="text-on-surface tabular-nums">{fixture.away_score ?? '-'}</span>
            </div>

            {/* HT Score */}
            {fixture.ht_home_score !== null && fixture.ht_away_score !== null && (
              <div className="text-[10px] text-on-surface-variant/30 font-medium mt-1 tracking-wider">
                HT: {fixture.ht_home_score} - {fixture.ht_away_score}
              </div>
            )}

            {/* Status Badge */}
            <div className="mt-3 flex items-center gap-2 px-4 py-1.5 rounded-full border border-outline-variant/20 bg-surface-container-highest/30">
              {isLive && (
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusConfig.color }} />
              )}
              <span
                className="text-[10px] font-black uppercase tracking-[0.25em]"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-5 text-center md:text-right flex-row-reverse md:flex-row">
            <div>
              <h2 className="font-bold text-lg tracking-tight text-on-surface uppercase">
                {awayTeam.name}
              </h2>
              <span className="text-[9px] uppercase font-bold text-on-surface-variant/40 tracking-widest">
                Visitante
              </span>
            </div>
            <div className="w-18 h-18 flex items-center justify-center">
              <img
                src={awayTeam.logo_url}
                alt={awayTeam.name}
                className="w-16 h-16 object-contain drop-shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).alt = awayTeam.short_name;
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
