/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { STATUS_LABELS } from '../constants';
import type { MatchCardData } from '../types';
import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';

interface LobbyProps {
  matches: MatchCardData[];
  onSelectMatch: (matchId: number) => void;
}

export default function Lobby({ matches, onSelectMatch }: LobbyProps) {
  const [search, setSearch] = useState('');

  // Group matches by league
  const grouped = useMemo(() => {
    const filtered = matches.filter((m) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.league.name.toLowerCase().includes(q)
      );
    });

    const groups: Record<string, { league: MatchCardData['league']; matches: MatchCardData[] }> = {};
    for (const match of filtered) {
      const key = match.league.name;
      if (!groups[key]) {
        groups[key] = { league: match.league, matches: [] };
      }
      groups[key].matches.push(match);
    }
    return Object.values(groups);
  }, [matches, search]);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar time ou liga..."
          className="w-full bg-surface-container border border-outline-variant/20 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-on-surface-variant/40 uppercase tracking-widest font-bold">
            Nenhuma partida encontrada
          </p>
          <p className="text-[10px] text-on-surface-variant/20 mt-2 uppercase tracking-wider">
            Tente alterar a data ou remover os filtros
          </p>
        </div>
      )}

      {/* Matches grouped by league */}
      {grouped.map((group) => (
        <div
          key={group.league.name}
          className="bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/20 shadow-xl"
        >
          {/* League Header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-surface-container-highest/10 border-b border-outline-variant/15">
            <img src={group.league.flagUrl} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
              {group.league.country}
            </span>
            <span className="text-[10px] text-on-surface-variant/20">•</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
              {group.league.name}
            </span>
          </div>

          {/* Match Rows */}
          <div className="divide-y divide-outline-variant/10">
            {group.matches.map((match) => {
              const statusConfig = STATUS_LABELS[match.status] || STATUS_LABELS['NS'];
              const isLive = statusConfig.pulse;
              const hasScore = match.homeTeam.score !== null;

              return (
                <div
                  key={match.id}
                  onClick={() => onSelectMatch(match.id)}
                  className="grid grid-cols-12 items-center py-4 px-5 hover:bg-surface-container-highest/10 cursor-pointer transition-all group"
                >
                  {/* Time / Status */}
                  <div className="col-span-2 flex flex-col items-start gap-0.5">
                    {isLive ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">
                          {statusConfig.label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-on-surface-variant/60">
                        {match.time}
                      </span>
                    )}
                    <span
                      className="text-[8px] font-bold uppercase tracking-widest"
                      style={{ color: statusConfig.color + '99' }}
                    >
                      {!isLive && statusConfig.label}
                    </span>
                  </div>

                  {/* Teams */}
                  <div className="col-span-8 flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-end gap-2.5">
                      <span className="text-xs font-bold text-on-surface text-right truncate group-hover:text-primary transition-colors">
                        {match.homeTeam.name}
                      </span>
                      <img
                        src={match.homeTeam.logoUrl}
                        alt=""
                        className="w-6 h-6 object-contain flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-1.5 min-w-[60px] justify-center">
                      {hasScore ? (
                        <>
                          <span className="text-sm font-black text-on-surface tabular-nums">{match.homeTeam.score}</span>
                          <span className="text-xs text-on-surface-variant/30 font-light">-</span>
                          <span className="text-sm font-black text-on-surface tabular-nums">{match.awayTeam.score}</span>
                        </>
                      ) : (
                        <span className="text-xs text-on-surface-variant/30 font-medium italic">vs</span>
                      )}
                    </div>

                    <div className="flex-1 flex items-center gap-2.5">
                      <img
                        src={match.awayTeam.logoUrl}
                        alt=""
                        className="w-6 h-6 object-contain flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-xs font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                        {match.awayTeam.name}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="col-span-2 flex justify-end">
                    <span className="text-on-surface-variant/20 group-hover:text-primary transition-colors text-xs">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-[9px] uppercase font-black tracking-[0.4em] text-on-surface-variant/15">
          DecoStats • Football Analytics Platform
        </p>
      </div>
    </div>
  );
}
