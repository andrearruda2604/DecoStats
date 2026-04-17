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
import { useState } from 'react';
import type { ToggleMode } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('LOBBY');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

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
  const currentPredictive = matchDetail
    ? toggle === 'TOTAL'
      ? matchDetail.predictive.FT
      : toggle === 'HT'
        ? matchDetail.predictive.HT
        : matchDetail.predictive['2H']
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

              {/* HT / FT / TOTAL Toggle */}
              <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                  <h3 className="font-headline font-bold text-[10px] tracking-[0.3em] uppercase text-on-surface-variant flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-primary" />
                    Estatísticas Detalhadas
                  </h3>
                  <p className="text-[9px] text-on-surface-variant/30 uppercase tracking-widest ml-8 mt-1">
                    {matchDetail.fixture.round}
                  </p>
                </div>

                <div className="inline-flex p-1 bg-surface-container rounded-xl border border-outline-variant/20">
                  {(['HT', 'FT', 'TOTAL'] as ToggleMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setToggle(mode)}
                      className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                        toggle === mode
                          ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                          : 'text-on-surface-variant/40 hover:text-on-surface'
                      }`}
                    >
                      {mode === 'TOTAL' ? 'Total' : mode === 'HT' ? '1º T' : '2º T'}
                    </button>
                  ))}
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
