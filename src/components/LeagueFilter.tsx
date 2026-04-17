/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
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
  return (
    <div className="space-y-4 mb-6">
      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-surface-container rounded-2xl p-3 border border-outline-variant/20">
        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
          className="p-2 hover:bg-surface-container-highest/30 rounded-lg transition-colors text-on-surface-variant/60 hover:text-primary"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm font-bold uppercase tracking-widest text-on-surface">
            {formatDisplayDate(selectedDate)}
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="bg-transparent text-[10px] text-on-surface-variant/40 outline-none cursor-pointer border border-outline-variant/20 rounded px-2 py-1"
          />
        </div>

        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
          className="p-2 hover:bg-surface-container-highest/30 rounded-lg transition-colors text-on-surface-variant/60 hover:text-primary"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* League Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex items-center gap-1 mr-1 text-on-surface-variant/40">
          <Filter className="w-3.5 h-3.5" />
        </div>

        <button
          onClick={() => onSelectLeague(null)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
            selectedLeagueId === null
              ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
              : 'bg-surface-container text-on-surface-variant/60 border-outline-variant/20 hover:border-primary/40 hover:text-on-surface'
          }`}
        >
          Todas
        </button>

        {leagues.map((league) => (
          <button
            key={league.id}
            onClick={() => onSelectLeague(selectedLeagueId === league.id ? null : league.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
              selectedLeagueId === league.id
                ? 'bg-primary text-on-primary border-primary shadow-lg shadow-primary/20'
                : 'bg-surface-container text-on-surface-variant/60 border-outline-variant/20 hover:border-primary/40 hover:text-on-surface'
            }`}
          >
            <img src={league.flag_url} alt="" className="w-4 h-3 object-cover rounded-sm" />
            {league.name}
          </button>
        ))}
      </div>
    </div>
  );
}
