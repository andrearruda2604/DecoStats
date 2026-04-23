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

  return (
    <div className="space-y-3 mb-5">
      {/* Date Navigation — Tab style */}
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

      {/* League Pills */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 overflow-x-auto sm:overflow-x-visible no-scrollbar pb-0.5">
        <button
          onClick={() => onSelectLeague(null)}
          className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border shadow-sm ${
            selectedLeagueId === null
              ? 'bg-primary text-on-primary border-primary ring-2 ring-primary/20'
              : 'bg-surface-container-high text-on-surface-variant border-outline-variant hover:border-primary/40 hover:bg-surface-container-highest'
          }`}
        >
          Todas
        </button>

        {leagues.map((league) => (
          <button
            key={league.id}
            onClick={() => onSelectLeague(selectedLeagueId === league.id ? null : league.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all border shadow-sm ${
              selectedLeagueId === league.id
                ? 'bg-primary text-on-primary border-primary ring-2 ring-primary/20'
                : 'bg-surface-container-high text-on-surface-variant border-outline-variant hover:border-primary/40 hover:bg-surface-container-highest'
            }`}
          >
            <div className="w-4 h-3 overflow-hidden rounded-[2px] shadow-sm border border-white/10">
              <img 
                src={league.flag_url || `https://media.api-sports.io/flags/${league.country_code?.toLowerCase()}.svg`} 
                alt="" 
                className="w-full h-full object-cover" 
              />
            </div>
            <span>{league.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
