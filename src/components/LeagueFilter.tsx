/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { League } from '../types';

interface LeagueFilterProps {
  leagues: League[];
  selectedLeagueId: number | null;
  onSelectLeague: (id: number | null) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === -1) return 'Ontem';
  if (diffDays === 1) return 'Amanhã';

  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function LeagueFilter({
  leagues,
  selectedLeagueId,
  onSelectLeague,
  selectedDate,
  onSelectDate,
}: LeagueFilterProps) {
  const displayDate = formatDisplayDate(selectedDate);
  const prevLabel = formatDisplayDate(shiftDate(selectedDate, -1));
  const nextLabel = formatDisplayDate(shiftDate(selectedDate, 1));
  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);

  return (
    <div className="space-y-2 mb-5">
      {/* Date Navigation */}
      <div className="flex items-center justify-between card px-2 py-1.5">
        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface-container-highest/30 transition-colors text-on-surface-variant/50 hover:text-on-surface"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{prevLabel}</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm font-black uppercase tracking-widest text-on-surface">
            {displayDate}
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="bg-transparent text-[10px] text-on-surface-variant/40 outline-none cursor-pointer border border-outline-variant rounded px-1.5 py-0.5 w-[110px]"
          />
        </div>

        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-surface-container-highest/30 transition-colors text-on-surface-variant/50 hover:text-on-surface"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{nextLabel}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* League Filter Rail */}
      <div className="card px-3 py-2 flex items-center gap-3">
        {/* TODAS */}
        <button
          onClick={() => onSelectLeague(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            selectedLeagueId === null
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant/40 hover:text-on-surface'
          }`}
        >
          Todas
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-outline-variant/30 flex-shrink-0" />

        {/* Scrollable logo badges */}
        <div className="relative flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {leagues.map((league) => (
              <button
                key={league.id}
                title={league.name}
                onClick={() => onSelectLeague(selectedLeagueId === league.id ? null : league.id)}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${
                  selectedLeagueId === league.id
                    ? 'border-primary bg-primary/15 ring-2 ring-primary/25'
                    : 'border-outline-variant/30 bg-surface-container-high hover:border-primary/30 hover:bg-surface-container-highest'
                }`}
              >
                <img
                  src={league.logo_url}
                  alt={league.name}
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.2';
                  }}
                />
              </button>
            ))}
          </div>
          {/* Right fade to hint at scrollability */}
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-surface-container to-transparent pointer-events-none" />
        </div>

        {/* Selected league name badge */}
        {selectedLeague && (
          <div className="flex-shrink-0 flex items-center gap-1.5 pl-2 border-l border-outline-variant/30">
            <img
              src={selectedLeague.logo_url}
              alt=""
              className="w-4 h-4 object-contain"
            />
            <span className="text-[9px] font-bold text-primary uppercase tracking-wide max-w-[90px] truncate">
              {selectedLeague.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
