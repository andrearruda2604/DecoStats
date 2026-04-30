/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, SlidersHorizontal } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import type { League } from '../types';

interface LeagueFilterProps {
  leagues: League[];
  selectedLeagueId: number | null;
  onSelectLeague: (id: number | null) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

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

const PT_COUNTRY: Record<string, string> = {
  'South America': 'América do Sul',
  'Europe':        'Europa',
  'World':         'Mundial',
  'England':       'Inglaterra',
  'Spain':         'Espanha',
  'Germany':       'Alemanha',
  'France':        'França',
  'Italy':         'Itália',
  'Portugal':      'Portugal',
  'Brazil':        'Brasil',
  'Argentina':     'Argentina',
  'Netherlands':   'Países Baixos',
  'Turkey':        'Turquia',
  'Belgium':       'Bélgica',
  'Scotland':      'Escócia',
};

function countryLabel(c: string) {
  return PT_COUNTRY[c] ?? c;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function LeagueFilter({
  leagues,
  selectedLeagueId,
  onSelectLeague,
  selectedDate,
  onSelectDate,
}: LeagueFilterProps) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayDate    = formatDisplayDate(selectedDate);
  const prevLabel      = formatDisplayDate(shiftDate(selectedDate, -1));
  const nextLabel      = formatDisplayDate(shiftDate(selectedDate, 1));
  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);

  // Auto-expand the country of the selected league
  useEffect(() => {
    if (selectedLeagueId) {
      const l = leagues.find((x) => x.id === selectedLeagueId);
      if (l) setExpandedCountry(l.country);
    }
  }, [selectedLeagueId, leagues]);

  // Build country groups sorted: international (no flag) first, then alphabetical
  const groups = useMemo(() => {
    const map = new Map<string, { flagUrl: string; logoUrl: string; leagues: League[] }>();
    for (const l of leagues) {
      if (!map.has(l.country)) {
        map.set(l.country, { flagUrl: l.flag_url, logoUrl: l.logo_url, leagues: [] });
      }
      map.get(l.country)!.leagues.push(l);
    }
    return Array.from(map.entries())
      .map(([country, data]) => ({ country, ...data }))
      .sort((a, b) => {
        const aIntl = !a.flagUrl;
        const bIntl = !b.flagUrl;
        if (aIntl !== bIntl) return aIntl ? -1 : 1;
        return countryLabel(a.country).localeCompare(countryLabel(b.country), 'pt');
      });
  }, [leagues]);

  function handleSelectLeague(id: number | null) {
    onSelectLeague(id);
    setMobileOpen(false);
  }

  function toggleCountry(country: string) {
    setExpandedCountry(expandedCountry === country ? null : country);
  }

  return (
    <div className="space-y-2 mb-4 lg:mb-0">
      {/* ── Date Navigation ─────────────────────────────── */}
      <div className="flex items-center justify-between card px-2 py-1.5">
        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-on-surface-variant/50 hover:text-on-surface"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline lg:hidden xl:inline">
            {prevLabel}
          </span>
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
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-on-surface-variant/50 hover:text-on-surface"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline lg:hidden xl:inline">
            {nextLabel}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Mobile toggle button ─────────────────────────── */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden w-full flex items-center justify-between card px-3 py-2.5 hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary/70" />
          {selectedLeague ? (
            <div className="flex items-center gap-2">
              <img src={selectedLeague.logo_url} alt="" className="w-4 h-4 object-contain" />
              <span className="text-[11px] font-bold text-on-surface">{selectedLeague.name}</span>
            </div>
          ) : (
            <span className="text-[11px] font-bold text-on-surface-variant/60">Todas as competições</span>
          )}
        </div>
        {mobileOpen
          ? <ChevronUp className="w-4 h-4 text-on-surface-variant/40" />
          : <ChevronDown className="w-4 h-4 text-on-surface-variant/40" />
        }
      </button>

      {/* ── Accordion ───────────────────────────────────── */}
      <div className={`${mobileOpen ? 'block' : 'hidden'} lg:block`}>
        <div className="rounded-xl border border-outline-variant/20 overflow-hidden bg-surface-container">

          {/* TODAS */}
          <button
            onClick={() => handleSelectLeague(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-outline-variant/10 ${
              selectedLeagueId === null
                ? 'bg-primary/15 text-primary'
                : 'hover:bg-white/5 text-on-surface-variant/60 hover:text-on-surface'
            }`}
          >
            {selectedLeagueId === null && (
              <div className="w-0.5 h-4 bg-primary rounded-full flex-shrink-0" />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest">
              Todas as competições
            </span>
          </button>

          {/* Country groups */}
          {groups.map((group) => {
            const isExpanded = expandedCountry === group.country;
            const hasSelection = group.leagues.some((l) => l.id === selectedLeagueId);

            return (
              <div key={group.country} className="border-b border-outline-variant/10 last:border-b-0">
                {/* Country header */}
                <button
                  onClick={() => toggleCountry(group.country)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    hasSelection
                      ? 'bg-primary/8 text-on-surface'
                      : 'hover:bg-white/5 text-on-surface-variant/80 hover:text-on-surface'
                  }`}
                >
                  {/* Flag or globe emoji */}
                  {group.flagUrl ? (
                    <img
                      src={group.flagUrl}
                      alt=""
                      className="w-5 h-3.5 object-cover rounded-[3px] flex-shrink-0 shadow-sm"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="text-base leading-none flex-shrink-0">
                      {group.country === 'South America' ? '🌎' : '🌍'}
                    </span>
                  )}

                  <span className="flex-1 text-[11px] font-bold uppercase tracking-wide truncate">
                    {countryLabel(group.country)}
                  </span>

                  <span className="text-[9px] font-bold text-on-surface-variant/30 mr-1">
                    {group.leagues.length}
                  </span>

                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-on-surface-variant/40 flex-shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant/40 flex-shrink-0" />
                  }
                </button>

                {/* League list */}
                {isExpanded && (
                  <div className="bg-black/20">
                    {group.leagues.map((league) => {
                      const isSelected = league.id === selectedLeagueId;
                      return (
                        <button
                          key={league.id}
                          onClick={() => handleSelectLeague(league.id)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors border-t border-outline-variant/5 ${
                            isSelected
                              ? 'bg-primary/15 text-primary'
                              : 'hover:bg-white/5 text-on-surface-variant/70 hover:text-on-surface'
                          }`}
                        >
                          {/* Selected indicator */}
                          <div className={`w-0.5 h-4 rounded-full flex-shrink-0 ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />

                          <img
                            src={league.logo_url}
                            alt=""
                            className="w-5 h-5 object-contain flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                          />

                          <span className={`flex-1 text-[11px] truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>
                            {league.name}
                          </span>

                          {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
