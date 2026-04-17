/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Layout, { ViewType } from './components/Layout';
import Scoreboard from './components/Scoreboard';
import StatsTable from './components/StatsTable';
import MatchEvents from './components/MatchEvents';
import Lobby from './components/Lobby';
import LeagueFilter from './components/LeagueFilter';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import { useMatches } from './hooks/useMatches';
import { useMatchStats } from './hooks/useMatchStats';
import { useState, useCallback } from 'react';
import type { ToggleMode, MatchCountFilter, ScopeFilter } from './types';
import { generatePredictiveData } from './services/api';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('LOBBY');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState<MatchCountFilter>(10);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('season');

  // Matches list hook
  const {
    matches,
    leagues,
    loading: matchesLoading,
    error: matchesError,
    selectedDate,
    selectedLeagueId,
    setSelectedDate,
    setSelectedLeagueId,
    refresh: refreshMatches,
  } = useMatches();

  // Match detail hook
  const {
    data: matchDetail,
    loading: detailLoading,
    error: detailError,
    toggle,
    setToggle,
    refresh: refreshDetail,
  } = useMatchStats(selectedMatchId);

  const handleSelectMatch = (matchId: number) => {
    setSelectedMatchId(matchId);
    setActiveView('DATA');
  };

  const handleBack = () => {
    setActiveView('LOBBY');
    setSelectedMatchId(null);
  };

  // Get the current predictions/stats based on toggle
  const predictiveBlock = matchDetail ? generatePredictiveData(matchDetail.homeTeam.id, matchDetail.awayTeam.id, matchCount, scopeFilter) : null;
  const currentPredictive = predictiveBlock
    ? toggle === 'TOTAL'
      ? predictiveBlock.FT
      : toggle === 'HT'
        ? predictiveBlock.HT
        : predictiveBlock['2H']
    : [];

  return (
    <Layout
      activeView={activeView}
      onNavigate={(view) => {
        if (view === 'LOBBY') handleBack();
        else setActiveView(view);
      }}
      showBack={activeView !== 'LOBBY'}
    >
      {/* ═══ LOBBY VIEW ═══ */}
      {activeView === 'LOBBY' && (
        <>
          <LeagueFilter
            leagues={leagues}
            selectedLeagueId={selectedLeagueId}
            onSelectLeague={setSelectedLeagueId}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {matchesLoading && <LoadingState message="Buscando partidas..." />}
          {matchesError && <ErrorState message={matchesError} onRetry={refreshMatches} />}
          {!matchesLoading && !matchesError && (
            <Lobby matches={matches} onSelectMatch={handleSelectMatch} />
          )}
        </>
      )}

      {/* ═══ DATA / MATCH DETAIL VIEW ═══ */}
      {activeView === 'DATA' && (
        <div className="animate-in fade-in duration-500 space-y-6">
          {detailLoading && <LoadingState message="Carregando dados da partida..." />}
          {detailError && <ErrorState message={detailError} onRetry={refreshDetail} />}

          {!detailLoading && !detailError && matchDetail && (
            <>
              {/* Scoreboard */}
              <Scoreboard data={matchDetail} />

              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-4">
                <div>
                  <h3 className="font-headline font-bold text-[11px] tracking-[0.3em] uppercase text-primary/80 flex items-center gap-3">
                    <span className="w-6 h-[1px] bg-primary" />
                    Análise Tática
                  </h3>
                  <p className="text-[12px] text-on-surface-variant/40 uppercase tracking-widest ml-9 mt-1.5 font-bold">
                    Métricas Distributivas Avançadas
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-surface-container/20 p-2 rounded-2xl border border-outline-variant/5">
                  
                  {/* Select Jogos */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-outline-variant/10">
                    <label className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant/40">Jogos:</label>
                    <select
                      value={matchCount}
                      onChange={(e) => setMatchCount(Number(e.target.value) as MatchCountFilter)}
                      className="bg-transparent text-xs font-bold text-on-surface outline-none cursor-pointer"
                    >
                      <option value={5} className="bg-[#121212] text-on-surface">5</option>
                      <option value={10} className="bg-[#121212] text-on-surface">10</option>
                      <option value={15} className="bg-[#121212] text-on-surface">15</option>
                      <option value={20} className="bg-[#121212] text-on-surface">20</option>
                    </select>
                  </div>

                  {/* Toggle Temp Atual */}
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-background rounded-lg border border-outline-variant/10">
                    <label className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant/40">Temp. Atual:</label>
                    <button 
                      onClick={() => setScopeFilter(scopeFilter === 'season' ? 'all' : 'season')}
                      className={`relative w-8 h-4 rounded-full transition-colors duration-300 ${scopeFilter === 'season' ? 'bg-primary' : 'bg-surface-variant/30'}`}
                    >
                      <div className={`absolute top-0.5 bg-white w-3 h-3 rounded-full transition-transform duration-300 ${scopeFilter === 'season' ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {/* HT / FT / TOTAL Toggle */}
                  <div className="flex items-center p-1 bg-background rounded-xl border border-outline-variant/10 ml-auto">
                    {(['HT', 'FT', 'TOTAL'] as ToggleMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setToggle(mode)}
                        className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                          toggle === mode
                            ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                            : 'text-on-surface-variant/30 hover:text-on-surface'
                        }`}
                      >
                        {mode === 'TOTAL' ? 'TOTAL' : mode === 'HT' ? 'HT' : 'FT'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Predictive Stats Table */}
              <StatsTable
                predictiveStats={currentPredictive}
                homeTeamName={matchDetail.homeTeam.name}
                awayTeamName={matchDetail.awayTeam.name}
                toggle={toggle}
              />

              {/* Match Events */}
              {matchDetail.events && matchDetail.events.length > 0 && !['NS', 'TBD', 'PST', 'CANC'].includes(matchDetail.fixture.status) && (
                <MatchEvents
                  events={matchDetail.events}
                  homeTeamId={matchDetail.homeTeam.id}
                  homeTeamName={matchDetail.homeTeam.name}
                  awayTeamName={matchDetail.awayTeam.name}
                />
              )}
            </>
          )}

          {/* Fallback: no match selected */}
          {!detailLoading && !detailError && !matchDetail && (
            <div className="text-center py-20">
              <p className="text-sm text-on-surface-variant/40 uppercase tracking-widest font-bold">
                Selecione uma partida no Lobby
              </p>
              <button
                onClick={handleBack}
                className="mt-6 px-6 py-2.5 bg-primary text-on-primary font-bold uppercase text-[10px] tracking-widest rounded-full"
              >
                Ir para o Lobby
              </button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
