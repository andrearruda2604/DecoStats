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

  const filtered = useMemo(() => {
    if (!search) return matches;
    const q = search.toLowerCase();
    return matches.filter((m) =>
      m.homeTeam.name.toLowerCase().includes(q) ||
      m.awayTeam.name.toLowerCase().includes(q) ||
      m.league.name.toLowerCase().includes(q)
    );
  }, [matches, search]);

  return (
    <div className="space-y-3 animate-in">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar time ou liga..."
          className="w-full bg-surface-container border border-outline-variant rounded-xl py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-on-surface-variant/40 uppercase tracking-widest font-bold">
            Nenhuma partida encontrada
          </p>
          <p className="text-[10px] text-on-surface-variant/20 mt-2">
            Tente alterar a data ou remover os filtros
          </p>
        </div>
      )}

      {/* Individual Match Cards */}
      {filtered.map((match) => {
        const statusConfig = STATUS_LABELS[match.status] || STATUS_LABELS['NS'];
        const isLive = statusConfig.pulse;
        const hasScore = match.homeTeam.score !== null;

        return (
          <div
            key={match.id}
            onClick={() => onSelectMatch(match.id)}
            className="card p-4 cursor-pointer hover:border-primary/30 transition-all active:scale-[0.99] group"
          >
            {/* Top row: League + Time */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <img src={match.league.flagUrl} alt="" className="w-4 h-3 object-cover rounded-sm" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/40">
                  {match.league.name}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: isLive ? statusConfig.color : undefined }}
                >
                  {isLive ? statusConfig.label : match.time}
                </span>
              </div>
            </div>

            {/* Home Team Row */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={match.homeTeam.logoUrl}
                  alt=""
                  className="w-6 h-6 object-contain flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-[13px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                  {match.homeTeam.name}
                </span>
              </div>
              <span className="text-sm font-black text-on-surface tabular-nums w-6 text-right">
                {hasScore ? match.homeTeam.score : ''}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-outline-variant/30 my-1" />

            {/* Away Team Row */}
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img
                  src={match.awayTeam.logoUrl}
                  alt=""
                  className="w-6 h-6 object-contain flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span className="text-[13px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                  {match.awayTeam.name}
                </span>
              </div>
              <span className="text-sm font-black text-on-surface tabular-nums w-6 text-right">
                {hasScore ? match.awayTeam.score : ''}
              </span>
            </div>

            {/* Status label for non-live */}
            {!isLive && match.status !== 'NS' && (
              <div className="mt-2 text-center">
                <span
                  className="text-[8px] font-bold uppercase tracking-widest"
                  style={{ color: statusConfig.color + '99' }}
                >
                  {statusConfig.label}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-[9px] uppercase font-black tracking-[0.4em] text-on-surface-variant/15">
          DecoStats · Football Analytics
        </p>
      </div>
    </div>
  );
}
