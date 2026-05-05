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
  sortBy: 'LEAGUE' | 'TIME';
  onSortChange: (sort: 'LEAGUE' | 'TIME') => void;
}


export default function Lobby({ matches, onSelectMatch, sortBy, onSortChange }: LobbyProps) {
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

  // Group by league name, preserving order
  const grouped = useMemo(() => {
    if (sortBy === 'TIME') return null;

    const map = new Map<string, { logoUrl: string; matches: MatchCardData[] }>();
    for (const m of filtered) {
      if (!map.has(m.league.name)) {
        map.set(m.league.name, { logoUrl: m.league.logoUrl, matches: [] });
      }
      map.get(m.league.name)!.matches.push(m);
    }
    return map;
  }, [filtered, sortBy]);

  const sortedByTime = useMemo(() => {
    if (sortBy !== 'TIME') return null;
    return [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filtered, sortBy]);

  const multipleLeagues = grouped ? grouped.size > 1 : false;


  return (
    <div className="space-y-4 animate-in">
      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar time ou liga..."
            className="w-full bg-surface-container border border-outline-variant rounded-xl py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        
        <div className="flex p-1 bg-surface-container border border-outline-variant rounded-xl self-start sm:self-center">
          <button
            onClick={() => onSortChange('LEAGUE')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
              sortBy === 'LEAGUE' ? 'bg-primary text-on-primary' : 'text-on-surface-variant/75 hover:text-on-surface'
            }`}
          >
            Liga
          </button>
          <button
            onClick={() => onSortChange('TIME')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
              sortBy === 'TIME' ? 'bg-primary text-on-primary' : 'text-on-surface-variant/75 hover:text-on-surface'
            }`}
          >
            Horário
          </button>
        </div>

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

      {/* Match groups (LEAGUE MODE) */}
      {sortBy === 'LEAGUE' && grouped && Array.from(grouped.entries()).map(([leagueName, { logoUrl, matches: group }]) => (
        <div key={leagueName} className="space-y-2">
          {/* League header — only when viewing multiple leagues */}
          {multipleLeagues && (
            <div className="flex items-center gap-2 px-1">
              <img src={logoUrl} alt="" className="w-4 h-4 object-contain opacity-80" />
              <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70">
                {leagueName}
              </span>
              <div className="flex-1 h-px bg-outline-variant/30" />
            </div>
          )}

          {/* Cards grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${!multipleLeagues ? 'pb-8' : ''}`}>
            {group.map((match) => <MatchCard key={match.id} match={match} onSelectMatch={onSelectMatch} />)}
          </div>
        </div>
      ))}

      {/* Flat list (TIME MODE) */}
      {sortBy === 'TIME' && sortedByTime && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
          {sortedByTime.map((match) => (
            <MatchCard key={match.id} match={match} onSelectMatch={onSelectMatch} showLeagueLabel />
          ))}
        </div>
      )}


      {/* Footer */}
      {filtered.length > 0 && (
        <div className="text-center py-6">
          <p className="text-[9px] uppercase font-black tracking-[0.4em] text-on-surface-variant/15">
            DecoStats · Football Analytics
          </p>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, onSelectMatch, showLeagueLabel }: { match: MatchCardData; onSelectMatch: (id: number) => void; showLeagueLabel?: boolean }) {
  const statusConfig = STATUS_LABELS[match.status] || STATUS_LABELS['NS'];
  const isLive = statusConfig.pulse;
  const hasScore = match.homeTeam.score !== null;

  return (
    <div
      onClick={() => onSelectMatch(match.id)}
      className="card p-4 cursor-pointer hover:border-primary/30 transition-all active:scale-[0.99] group flex flex-col justify-between"
    >
      {/* Time / status */}
      <div className="flex items-center justify-between mb-3 min-h-[16px]">
        {showLeagueLabel ? (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <img src={match.league.logoUrl} alt="" className="w-3 h-3 object-contain opacity-70 flex-shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-variant/65 truncate">
              {match.league.name}
            </span>
          </div>
        ) : <div />}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          <span
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: isLive ? statusConfig.color : undefined }}
          >
            {isLive ? statusConfig.label : match.time}
          </span>
        </div>
      </div>

      {/* Teams */}
      <div className="space-y-1">
        <div className="flex items-center justify-between py-1">
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

        <div className="border-t border-outline-variant/10 my-0.5" />

        <div className="flex items-center justify-between py-1">
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
      </div>

      {/* Finished status */}
      {!isLive && match.status !== 'NS' && (
        <div className="mt-3 pt-2 border-t border-outline-variant/10 text-center">
          <span
            className="text-[8px] font-bold uppercase tracking-widest"
            style={{ color: statusConfig.color + 'aa' }}
          >
            {statusConfig.label}
          </span>
        </div>
      )}
    </div>
  );
}

