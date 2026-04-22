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
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        <button
          onClick={() => onSelectLeague(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${
            selectedLeagueId === null
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-surface-container text-on-surface-variant/60 border-outline-variant hover:border-primary/40'
          }`}
        >
          Todas
        </button>

        {leagues.map((league) => (
          <button
            key={league.id}
            onClick={() => onSelectLeague(selectedLeagueId === league.id ? null : league.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${
              selectedLeagueId === league.id
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container text-on-surface-variant/60 border-outline-variant hover:border-primary/40'
            }`}
          >
            <img src={league.flag_url} alt="" className="w-3.5 h-2.5 object-cover rounded-sm" />
            {league.name}
          </button>
        ))}
      </div>
    </div>
  );
}
