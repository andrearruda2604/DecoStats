/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Check, SlidersHorizontal, X } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import type { League } from '../types';

interface LeagueFilterProps {
  leagues: League[];
  selectedLeagueIds: number[];
  onSelectLeagues: (ids: number[]) => void;
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

function countryLabel(c: string) { return PT_COUNTRY[c] ?? c; }

// ─── component ──────────────────────────────────────────────────────────────

export default function LeagueFilter({
  leagues,
  selectedLeagueIds,
  onSelectLeagues,
  selectedDate,
  onSelectDate,
}: LeagueFilterProps) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayDate = formatDisplayDate(selectedDate);
  const prevLabel   = formatDisplayDate(shiftDate(selectedDate, -1));
  const nextLabel   = formatDisplayDate(shiftDate(selectedDate, 1));

  const selectedSet = useMemo(() => new Set(selectedLeagueIds), [selectedLeagueIds]);
  const hasSelection = selectedLeagueIds.length > 0;

  // Auto-expand the country of the first selected league
  useEffect(() => {
    if (selectedLeagueIds.length > 0) {
      const first = leagues.find((x) => x.id === selectedLeagueIds[0]);
      if (first) setExpandedCountry(first.country);
    }
  }, []);   // only on mount to avoid closing accordion mid-interaction

  // Group by country: international (no flag) first, then alphabetical
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

  function toggleLeague(id: number) {
    if (selectedSet.has(id)) {
      onSelectLeagues(selectedLeagueIds.filter((x) => x !== id));
    } else {
      onSelectLeagues([...selectedLeagueIds, id]);
    }
  }

  function toggleCountryAll(group: { leagues: League[] }) {
    const ids = group.leagues.map((l) => l.id);
    const allSelected = ids.every((id) => selectedSet.has(id));
    if (allSelected) {
      onSelectLeagues(selectedLeagueIds.filter((id) => !ids.includes(id)));
    } else {
      const toAdd = ids.filter((id) => !selectedSet.has(id));
      onSelectLeagues([...selectedLeagueIds, ...toAdd]);
    }
  }

  function clearAll() {
    onSelectLeagues([]);
    setMobileOpen(false);
  }

  // Mobile label
  const mobileLabel = hasSelection
    ? selectedLeagueIds.length === 1
      ? (leagues.find((l) => l.id === selectedLeagueIds[0])?.name ?? '1 selecionada')
      : `${selectedLeagueIds.length} competições`
    : 'Todas as competições';

  return (
    <div className="space-y-2 mb-4 lg:mb-0">
      {/* ── Date Navigation ─────────────────────────── */}
      <div className="flex items-center justify-between card px-1 sm:px-2 py-1.5 overflow-hidden">
        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-on-surface-variant/50 hover:text-on-surface shrink-0"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline lg:hidden xl:inline truncate max-w-[50px]">
            {prevLabel}
          </span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 justify-center">
          <span className="text-[11px] sm:text-sm font-black uppercase tracking-widest text-on-surface truncate">{displayDate}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="bg-transparent text-[10px] text-on-surface-variant/40 outline-none cursor-pointer border border-outline-variant rounded px-1 sm:px-1.5 py-0.5 w-[90px] sm:w-[110px] shrink-0"
          />
        </div>

        <button
          onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-on-surface-variant/50 hover:text-on-surface shrink-0"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline lg:hidden xl:inline truncate max-w-[50px]">
            {nextLabel}
          </span>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>

      {/* ── Mobile toggle ───────────────────────────── */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden w-full flex items-center justify-between card px-3 py-2.5 hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary/70" />
          <span className={`text-[11px] font-bold ${hasSelection ? 'text-primary' : 'text-on-surface-variant/60'}`}>
            {mobileLabel}
          </span>
          {hasSelection && (
            <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[8px] font-black flex items-center justify-center">
              {selectedLeagueIds.length}
            </span>
          )}
        </div>
        {mobileOpen
          ? <ChevronUp className="w-4 h-4 text-on-surface-variant/40" />
          : <ChevronDown className="w-4 h-4 text-on-surface-variant/40" />
        }
      </button>

      {/* ── Accordion ──────────────────────────────── */}
      <div className={`${mobileOpen ? 'block' : 'hidden'} lg:block`}>
        <div className="rounded-xl border border-outline-variant/20 overflow-hidden bg-surface-container">

          {/* Header row: TODAS + LIMPAR */}
          <div className="flex items-center border-b border-outline-variant/10">
            <button
              onClick={clearAll}
              className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                !hasSelection
                  ? 'text-primary bg-primary/10'
                  : 'text-on-surface-variant/60 hover:bg-white/5 hover:text-on-surface'
              }`}
            >
              {!hasSelection && <div className="w-0.5 h-4 bg-primary rounded-full flex-shrink-0" />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                Todas as competições
              </span>
            </button>

            {/* LIMPAR button — only when something is selected */}
            {hasSelection && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-red-400/80 hover:text-red-400 hover:bg-red-400/10 transition-colors border-l border-outline-variant/10"
              >
                <X className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>

          {/* Country groups */}
          {groups.map((group) => {
            const isExpanded = expandedCountry === group.country;
            const groupSelectedCount = group.leagues.filter((l) => selectedSet.has(l.id)).length;
            const allGroupSelected = groupSelectedCount === group.leagues.length;

            return (
              <div key={group.country} className="border-b border-outline-variant/10 last:border-b-0">
                {/* Country header */}
                <div className="flex items-center">
                  <button
                    onClick={() => setExpandedCountry(isExpanded ? null : group.country)}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      groupSelectedCount > 0
                        ? 'text-on-surface'
                        : 'text-on-surface-variant/80 hover:text-on-surface hover:bg-white/5'
                    }`}
                  >
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

                    {/* Selected count badge */}
                    {groupSelectedCount > 0 && (
                      <span className="text-[8px] font-black bg-primary text-on-primary rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                        {groupSelectedCount}
                      </span>
                    )}

                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-on-surface-variant/40 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant/40 flex-shrink-0" />
                    }
                  </button>

                  {/* Select-all country toggle (visible on hover / expanded) */}
                  {isExpanded && group.leagues.length > 1 && (
                    <button
                      onClick={() => toggleCountryAll(group)}
                      className={`px-2.5 py-2.5 text-[8px] font-bold uppercase tracking-wider border-l border-outline-variant/10 transition-colors ${
                        allGroupSelected
                          ? 'text-primary hover:text-red-400'
                          : 'text-on-surface-variant/40 hover:text-primary'
                      }`}
                    >
                      {allGroupSelected ? 'Desm.' : 'Todos'}
                    </button>
                  )}
                </div>

                {/* League items */}
                {isExpanded && (
                  <div className="bg-black/20">
                    {group.leagues.map((league) => {
                      const isSelected = selectedSet.has(league.id);
                      return (
                        <button
                          key={league.id}
                          onClick={() => toggleLeague(league.id)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors border-t border-outline-variant/5 ${
                            isSelected
                              ? 'bg-primary/15 text-primary'
                              : 'hover:bg-white/5 text-on-surface-variant/70 hover:text-on-surface'
                          }`}
                        >
                          <div className={`w-0.5 h-4 rounded-full flex-shrink-0 ${isSelected ? 'bg-primary' : 'bg-transparent'}`} />

                          <div className="w-5 h-5 bg-white/90 rounded-sm p-0.5 flex-shrink-0 flex items-center justify-center">
                            <img
                              src={league.logo_url}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.opacity = '0.3'; }}
                            />
                          </div>

                          <span className={`flex-1 text-[11px] truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>
                            {league.name}
                          </span>

                          {/* Checkbox-style indicator */}
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-outline-variant/30'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-on-primary" />}
                          </div>
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
