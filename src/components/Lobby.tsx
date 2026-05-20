/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { STATUS_LABELS } from '../constants';
import type { MatchCardData } from '../types';
import { Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

interface LobbyProps {
  matches: MatchCardData[];
  onSelectMatch: (matchId: number) => void;
  sortBy: 'LEAGUE' | 'TIME';
  onSortChange: (sort: 'LEAGUE' | 'TIME') => void;
}


export default function Lobby({ matches, onSelectMatch, sortBy, onSortChange }: LobbyProps) {
  const [search, setSearch] = useState('');
  const [hideFinished, setHideFinished] = useState(() => {
    const saved = localStorage.getItem('decostats_hide_finished');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('decostats_hide_finished', String(hideFinished));
  }, [hideFinished]);

  const filtered = useMemo(() => {
    let result = matches;

    if (hideFinished) {
      result = result.filter(m => !['FT', 'AET', 'PEN'].includes(m.status));
    }

    if (!search) return result;
    const q = search.toLowerCase();
    return result.filter((m) =>
      m.homeTeam.name.toLowerCase().includes(q) ||
      m.awayTeam.name.toLowerCase().includes(q) ||
      m.league.name.toLowerCase().includes(q)
    );
  }, [matches, search, hideFinished]);

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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar time ou liga..."
            className="w-full bg-surface-container border border-outline-variant rounded-xl py-3 pl-11 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/55 outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={hideFinished}
                onChange={(e) => setHideFinished(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-surface-container border border-outline-variant rounded-full peer peer-checked:bg-primary transition-colors" />
              <div className="absolute left-1 top-1 w-2 h-2 bg-on-surface-variant/50 rounded-full peer-checked:translate-x-4 peer-checked:bg-on-primary transition-transform" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant/50 peer-checked:text-on-surface transition-colors">
              Ocultar Encerrados
            </span>
          </label>

          <div className="flex p-1 bg-surface-container border border-outline-variant rounded-xl">
            <button
              onClick={() => onSortChange('LEAGUE')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                sortBy === 'LEAGUE' ? 'bg-primary text-on-primary' : 'text-on-surface-variant/50 hover:text-on-surface'
              }`}
            >
              Liga
            </button>
            <button
              onClick={() => onSortChange('TIME')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                sortBy === 'TIME' ? 'bg-primary text-on-primary' : 'text-on-surface-variant/50 hover:text-on-surface'
              }`}
            >
              Horário
            </button>
          </div>
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
      {sortBy === 'LEAGUE' && grouped && Array.from(grouped.entries()).map(([leagueName, { logoUrl, matches: group }]) => {
        const firstMatch = group[0];
        return (
          <div key={leagueName} className="bg-surface rounded-2xl overflow-hidden shadow-lg border border-outline-variant/10">
            {/* League Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container/30 border-b border-outline-variant/10">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white/90 rounded-sm p-0.5 flex-shrink-0 flex items-center justify-center">
                  <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-[9px] text-on-surface-variant/70 uppercase tracking-widest font-semibold leading-none mb-1">
                    {firstMatch.league.country}
                  </p>
                  <p className="text-xs font-bold uppercase text-on-surface">
                    {leagueName}
                  </p>
                </div>
              </div>
            </div>

            {/* Matches List */}
            <div className="flex flex-col">
              {group.map((match, idx) => (
                <MatchRow 
                  key={match.id} 
                  match={match} 
                  onSelectMatch={onSelectMatch} 
                  isLast={idx === group.length - 1} 
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Flat list (TIME MODE) */}
      {sortBy === 'TIME' && sortedByTime && (
        <div className="flex flex-col bg-surface rounded-2xl overflow-hidden shadow-lg border border-outline-variant/10 pb-2">
          {sortedByTime.map((match, idx) => (
            <MatchRow 
              key={match.id} 
              match={match} 
              onSelectMatch={onSelectMatch} 
              showLeagueLabel 
              isLast={idx === sortedByTime.length - 1} 
            />
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

function MatchRow({ match, onSelectMatch, showLeagueLabel, isLast }: { match: MatchCardData; onSelectMatch: (id: number) => void; showLeagueLabel?: boolean; isLast?: boolean }) {
  const statusConfig = STATUS_LABELS[match.status] || STATUS_LABELS['NS'];
  const isLive = statusConfig.pulse;
  const hasScore = match.homeTeam.score !== null;

  return (
    <div
      onClick={() => onSelectMatch(match.id)}
      className={`flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer ${!isLast ? 'border-b border-outline-variant/5' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Team Logos */}
        <div className="flex flex-col gap-1.5 items-center justify-center w-8">
          <img
            src={match.homeTeam.logoUrl}
            alt=""
            className="w-5 h-5 object-contain flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <img
            src={match.awayTeam.logoUrl}
            alt=""
            className="w-5 h-5 object-contain flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        
        {/* Team Names */}
        <div className="flex flex-col gap-2 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-none text-on-surface truncate">
              {match.homeTeam.name}
            </span>
            {hasScore && (
              <span className="text-sm font-bold text-on-surface tabular-nums">
                {match.homeTeam.score}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-on-surface-variant font-medium leading-none truncate">
              {match.awayTeam.name}
            </span>
            {hasScore && (
              <span className="text-sm font-bold text-on-surface-variant tabular-nums">
                {match.awayTeam.score}
              </span>
            )}
          </div>
          {showLeagueLabel && (
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant/40 font-bold mt-1">
              {match.league.name}
            </p>
          )}
        </div>
      </div>

      {/* Match Status / Time */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 pl-2">
        <div className="flex items-center gap-1.5">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          <span
            className="text-[11px] font-black uppercase tracking-wider tabular-nums"
            style={{ color: isLive ? statusConfig.color : 'var(--on-surface-variant)' }}
          >
            {isLive ? statusConfig.label : match.time}
          </span>
        </div>
        {!isLive && match.status !== 'NS' && (
          <span
            className="text-[9px] font-bold uppercase tracking-widest mt-1"
            style={{ color: statusConfig.color + 'cc' }}
          >
            {statusConfig.label}
          </span>
        )}
      </div>
    </div>
  );
}

