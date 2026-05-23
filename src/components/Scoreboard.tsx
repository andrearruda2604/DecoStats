/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MatchDetailData } from '../types';
import { STATUS_LABELS } from '../constants';

interface ScoreboardProps {
  data: MatchDetailData;
  homeRank?: number | null;
  awayRank?: number | null;
}

export default function Scoreboard({ data, homeRank, awayRank }: ScoreboardProps) {
  const { fixture, homeTeam, awayTeam, league } = data;
  const statusConfig = STATUS_LABELS[fixture.status] || STATUS_LABELS['NS'];
  const isLive = statusConfig.pulse;

  return (
    <section className="relative overflow-hidden pt-4 pb-6 bg-gradient-to-b from-primary/10 to-transparent rounded-[32px] border border-outline-variant/10">
      {/* League Header */}
      <div className="flex flex-col items-center w-full mb-6 px-4">
        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 flex items-center gap-2">
          <img referrerPolicy="no-referrer" src={league.flag_url} alt="" className="w-4 h-3 object-cover rounded-sm" />
          {league.country} <span className="text-on-surface-variant/30">&gt;</span> {league.name}
        </span>
      </div>

      {/* Teams & Score Large */}
      <div className="flex justify-center items-center px-2 gap-2 sm:gap-6">
        {/* Home */}
        <div className="flex flex-col items-center gap-2 w-1/3">
          {homeRank != null && (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[8px] font-black uppercase tracking-widest text-primary/50">Posição</span>
              <span className="text-2xl font-black text-primary tabular-nums">{homeRank}°</span>
            </div>
          )}
          <img referrerPolicy="no-referrer"
            src={homeTeam.logo_url}
            alt={homeTeam.name}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border border-outline-variant/20 shadow-xl object-contain p-1.5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-xs sm:text-sm font-bold text-center leading-tight truncate w-full px-1">{homeTeam.name}</span>
        </div>
        
        {/* Score/Time */}
        <div className="flex flex-col items-center w-1/3 flex-shrink-0">
          <div className="flex items-center justify-center text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
            <span>{fixture.home_score ?? '–'}</span>
            <span className="text-on-surface-variant/30 font-light mx-1.5 mb-1">:</span>
            <span>{fixture.away_score ?? '–'}</span>
          </div>
          
          {fixture.ht_home_score !== null && fixture.ht_away_score !== null && (
            <span className="text-[10px] text-on-surface-variant/50 font-bold mt-1">HT {fixture.ht_home_score}-{fixture.ht_away_score}</span>
          )}
          
          <span className="text-[9px] bg-surface-container-highest px-3 py-1.5 rounded-full text-on-surface-variant mt-2.5 uppercase font-black tracking-widest flex items-center gap-1.5 shadow-sm border border-outline-variant/10">
            {isLive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusConfig.color }} />}
            <span style={{ color: statusConfig.color }}>{statusConfig.label}</span>
          </span>
        </div>
        
        {/* Away */}
        <div className="flex flex-col items-center gap-2 w-1/3">
          {awayRank != null && (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[8px] font-black uppercase tracking-widest text-primary/50">Posição</span>
              <span className="text-2xl font-black text-primary tabular-nums">{awayRank}°</span>
            </div>
          )}
          <img referrerPolicy="no-referrer"
            src={awayTeam.logo_url}
            alt={awayTeam.name}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white border border-outline-variant/20 shadow-xl object-contain p-1.5"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-xs sm:text-sm font-bold text-center leading-tight truncate w-full px-1">{awayTeam.name}</span>
        </div>
      </div>
    </section>
  );
}
