/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Layout, { ViewType } from './components/Layout';
import Scoreboard from './components/Scoreboard';
import StatsTable from './components/StatsTable';
import MatchEvents from './components/MatchEvents';
import Lobby from './components/Lobby';
import Odd20 from './components/Odd20';
import LeagueFilter from './components/LeagueFilter';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import { useMatches } from './hooks/useMatches';
import { useMatchStats } from './hooks/useMatchStats';
import { useState, useEffect } from 'react';
import type { ToggleMode } from './types';
import { fetchPredictiveData } from './services/api';

const VERSION = '1.0.2-live-engine';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('LOBBY');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [toggle, setToggle] = useState<ToggleMode>('FT');
  const [statsCount, setStatsCount] = useState<number>(20);
  const [seasonOnly, setSeasonOnly] = useState(true);
  const [mandoOnly, setMandoOnly] = useState(true);
  const [show100Only, setShow100Only] = useState(false);

  const [predictiveBlock, setPredictiveBlock] = useState<any>(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);

  const {
    matches, leagues, loading: matchesLoading, error: matchesError,
    selectedDate, selectedLeagueId, setSelectedDate, setSelectedLeagueId, refresh: refreshMatches,
  } = useMatches();

  const {
    data: matchDetail, loading: detailLoading, error: detailError, refresh: refreshDetail,
  } = useMatchStats(selectedMatchId);

  const handleSelectMatch = (matchId: number) => {
    setSelectedMatchId(matchId);
    setActiveView('DATA');
  };

  const handleBack = () => {
    setActiveView('LOBBY');
    setSelectedMatchId(null);
  };

  useEffect(() => {
    let isMounted = true;
    if (matchDetail) {
      setPredictiveLoading(true);
      fetchPredictiveData(matchDetail.homeTeam.api_id, matchDetail.awayTeam.api_id, statsCount, {
        seasonOnly,
        mandoOnly,
        leagueId: matchDetail.league?.api_id,
        season: matchDetail.league?.current_season || matchDetail.fixture?.season,
        matchDate: matchDetail.fixture?.date,
      })
        .then(res => { if (isMounted) { setPredictiveBlock(res); setPredictiveLoading(false); } })
        .catch(() => { if (isMounted) setPredictiveLoading(false); });
    } else {
      setPredictiveBlock(null);
    }
    return () => { isMounted = false; };
  }, [matchDetail, statsCount, seasonOnly, mandoOnly]);

  const currentPredictive = predictiveBlock
    ? predictiveBlock[toggle] || []
    : [];

  return (
    <Layout
      activeView={activeView}
      onNavigate={(view) => { if (view === 'LOBBY') handleBack(); else setActiveView(view); }}
      showBack={activeView !== 'LOBBY'}
    >
      {/* ═══ LOBBY ═══ */}
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

      {/* ═══ MATCH DETAIL ═══ */}
      {activeView === 'DATA' && (
        <div className="animate-in space-y-4">
          {detailLoading && <LoadingState message="Carregando dados..." />}
          {detailError && <ErrorState message={detailError} onRetry={refreshDetail} />}

          {!detailLoading && !detailError && matchDetail && (
            <>
              <Scoreboard data={matchDetail} />

              {/* Filter Bar — compact scrollable */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1">
                {/* Match Count */}
                <div className="flex items-center gap-1.5 px-3 py-2 card flex-shrink-0">
                  <label className="text-[8px] uppercase font-bold tracking-widest text-on-surface-variant/40">Jogos</label>
                  <select
                    value={statsCount}
                    onChange={(e) => setStatsCount(Number(e.target.value))}
                    className="bg-transparent text-[11px] font-bold text-on-surface outline-none cursor-pointer"
                  >
                    <option value={5} className="bg-black">5</option>
                    <option value={10} className="bg-black">10</option>
                    <option value={15} className="bg-black">15</option>
                    <option value={20} className="bg-black">20</option>
                  </select>
                </div>

                {/* Season Toggle */}
                <button
                  onClick={() => setSeasonOnly(!seasonOnly)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] border transition-all flex-shrink-0 text-[9px] font-bold uppercase tracking-wider ${
                    seasonOnly
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant/50'
                  }`}
                >
                  TEMPORADA
                </button>

                {/* Mando Toggle */}
                <button
                  onClick={() => setMandoOnly(!mandoOnly)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] border transition-all flex-shrink-0 text-[9px] font-bold uppercase tracking-wider ${
                    mandoOnly
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant/50'
                  }`}
                >
                  Mando
                </button>

                {/* 100% Filter */}
                <button
                  onClick={() => setShow100Only(!show100Only)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] border transition-all flex-shrink-0 text-[9px] font-bold uppercase tracking-wider ${
                    show100Only
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-outline-variant bg-surface-container text-on-surface-variant/50'
                  }`}
                >
                  🎯 100%
                </button>

                {/* HT / 2H / FT */}
                <div className="flex items-center p-0.5 card flex-shrink-0">
                  {(['HT', '2H', 'FT'] as ToggleMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setToggle(mode)}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                        toggle === mode
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant/30 hover:text-on-surface'
                      }`}
                    >
                      {mode === 'FT' ? 'TOTAL' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="relative min-h-[200px]">
                {predictiveLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
                    <div className="w-7 h-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  </div>
                )}
                <StatsTable
                  predictiveStats={currentPredictive}
                  homeTeamName={matchDetail.homeTeam.name}
                  awayTeamName={matchDetail.awayTeam.name}
                  toggle={toggle}
                  show100Only={show100Only}
                />
              </div>

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

          {!detailLoading && !detailError && !matchDetail && (
            <div className="text-center py-20">
              <p className="text-sm text-on-surface-variant/40 uppercase tracking-widest font-bold">
                Selecione uma partida no Lobby
              </p>
              <button onClick={handleBack} className="mt-6 px-6 py-2.5 bg-primary text-on-primary font-bold uppercase text-[10px] tracking-widest rounded-full">
                Ir para o Lobby
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ODD 2.0 ═══ */}
      {activeView === 'ODD20' && (
        <Odd20 selectedDate={selectedDate} />
      )}
    </Layout>
  );
}
