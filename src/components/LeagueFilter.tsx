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

// Extracts a unique short label from the league name
function shortLabel(name: string): string {
  const generics = new Set(['Copa', 'Liga', 'UEFA', 'CONMEBOL', 'Club', 'de']);
  const words = name.split(' ');
  const key = words.find((w) => !generics.has(w) && w.length > 1);
  const label = (key || words[0]).toUpperCase();
  return label.length > 6 ? label.slice(0, 5) + '.' : label;
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
          <span className="text-sm font-black uppercase tracking-widest text-on-surface">{displayDate}</span>
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
      <div className="card px-3 py-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* TODAS */}
          <button
            onClick={() => onSelectLeague(null)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all border min-w-[48px] ${
              selectedLeagueId === null
                ? 'bg-primary/15 border-primary text-primary ring-1 ring-primary/30'
                : 'border-outline-variant/20 text-on-surface-variant/40 hover:border-outline-variant/60 hover:text-on-surface-variant'
            }`}
          >
            <span className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5">
              Todas
            </span>
          </button>

          {/* Separator */}
          <div className="w-px h-8 bg-outline-variant/20 flex-shrink-0 mx-0.5" />

          {/* League pills */}
          {leagues.map((league) => {
            const isSelected = selectedLeagueId === league.id;
            return (
              <button
                key={league.id}
                title={league.name}
                onClick={() => onSelectLeague(isSelected ? null : league.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all border min-w-[48px] ${
                  isSelected
                    ? 'bg-primary/15 border-primary ring-1 ring-primary/30'
                    : 'border-outline-variant/20 hover:border-outline-variant/60 hover:bg-surface-container-highest/40'
                }`}
              >
                {/* Logo on white/light bg bubble for visibility */}
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                  <img
                    src={league.logo_url}
                    alt=""
                    className="w-5 h-5 object-contain drop-shadow-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                </div>
                {/* Short label */}
                <span
                  className={`text-[7px] font-black uppercase tracking-wide leading-none ${
                    isSelected ? 'text-primary' : 'text-on-surface-variant/50'
                  }`}
                >
                  {shortLabel(league.name)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
