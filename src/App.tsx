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
import LoginPage from './components/LoginPage';
import TestView from './components/TestView';
import TeamFormTab from './components/TeamFormTab';
import { useMatches } from './hooks/useMatches';
import { useMatchStats } from './hooks/useMatchStats';
import { useAuth } from './contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import type { ToggleMode } from './types';
import { fetchPredictiveData } from './services/api';

const VERSION = '1.0.2-live-engine';

export default function App() {
  const { user, loading: authLoading } = useAuth();

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Test view — access via ?view=teste
  if (new URLSearchParams(window.location.search).get('view') === 'teste') {
    return <TestView />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [activeView, setActiveView] = useState<ViewType>('LOBBY');
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [toggle, setToggle] = useState<ToggleMode>('FT');
  const [statsCount, setStatsCount] = useState<number>(20);
  const [ligaFilter, setLigaFilter] = useState<'all' | 'game'>('game');
  const [seasonOnly, setSeasonOnly] = useState<boolean>(true);
  const [mandoGame, setMandoGame] = useState(false);
  const [show100Only, setShow100Only] = useState(false);
  const [sortBy, setSortBy] = useState<'LEAGUE' | 'TIME'>(() => {
    return (localStorage.getItem('decostats_sort_by') as 'LEAGUE' | 'TIME') || 'LEAGUE';
  });
  const [lobbyScrollPos, setLobbyScrollPos] = useState(0);
  const [oddScrollPos, setOddScrollPos] = useState(0);
  const [lastListView, setLastListView] = useState<'LOBBY' | 'ODD20' | 'ODD30'>('LOBBY');


  const [predictiveBlock, setPredictiveBlock] = useState<any>(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState<'stats' | 'form'>('stats');

  // Tracks when the app's own back button triggered history.back() so the
  // popstate handler knows not to double-navigate.
  const appInitiatedBackRef = useRef(false);

  const {
    matches, leagues, loading: matchesLoading, error: matchesError,
    selectedDate, selectedLeagueIds, setSelectedDate, setSelectedLeagueIds, refresh: refreshMatches,
  } = useMatches();

  const {
    data: matchDetail, loading: detailLoading, error: detailError, refresh: refreshDetail,
  } = useMatchStats(selectedMatchId);

  const handleSelectMatch = (matchId: number) => {
    if (activeView === 'LOBBY') {
      setLobbyScrollPos(window.scrollY);
      setLastListView('LOBBY');
    } else if (activeView === 'ODD20') {
      setOddScrollPos(window.scrollY);
      setLastListView('ODD20');
    } else if (activeView === 'ODD30') {
      setOddScrollPos(window.scrollY);
      setLastListView('ODD30');
    }
    setSelectedMatchId(matchId);
    setActiveView('DATA');
    setActiveDataTab('stats');
    window.scrollTo(0, 0);
    window.history.pushState({ inApp: true }, '');
  };

  const handleBack = () => {
    appInitiatedBackRef.current = true;
    setSelectedMatchId(null);
    setActiveView(lastListView);
    window.history.back();
  };

  // Intercept browser / mobile back button
  useEffect(() => {
    const onPopState = () => {
      if (appInitiatedBackRef.current) {
        appInitiatedBackRef.current = false;
        return;
      }
      if (activeView === 'DATA') {
        setSelectedMatchId(null);
        setActiveView(lastListView);
      } else if (activeView === 'ODD20' || activeView === 'ODD30') {
        setActiveView('LOBBY');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeView, lastListView]);

  useEffect(() => {
    if (activeView === 'LOBBY') {
      setTimeout(() => window.scrollTo(0, lobbyScrollPos), 10);
    } else if (activeView === 'ODD20' || activeView === 'ODD30') {
      setTimeout(() => window.scrollTo(0, oddScrollPos), 10);
    }
  }, [activeView, lobbyScrollPos, oddScrollPos]);

  useEffect(() => {
    localStorage.setItem('decostats_sort_by', sortBy);
  }, [sortBy]);


  useEffect(() => {
    let isMounted = true;
    if (matchDetail) {
      setPredictiveLoading(true);
      fetchPredictiveData(matchDetail.homeTeam.api_id, matchDetail.awayTeam.api_id, statsCount, {
        seasonOnly: seasonOnly,
        mandoOnly: mandoGame,
        leagueId: ligaFilter === 'game' ? matchDetail.league?.api_id : undefined,
        season: matchDetail.league?.season || matchDetail.fixture?.season,
        matchDate: matchDetail.fixture?.date,
      })
        .then(res => { if (isMounted) { setPredictiveBlock(res); setPredictiveLoading(false); } })
        .catch(() => { if (isMounted) setPredictiveLoading(false); });
    } else {
      setPredictiveBlock(null);
    }
    return () => { isMounted = false; };
  }, [matchDetail, statsCount, ligaFilter, seasonOnly, mandoGame]);

  const currentPredictive = predictiveBlock
    ? predictiveBlock[toggle] || []
    : [];

  return (
    <Layout
      activeView={activeView}
      onNavigate={(view) => {
        if (view === 'LOBBY') {
          handleBack();
        } else {
          setActiveView(view);
          window.history.pushState({ inApp: true }, '');
        }
      }}
      showBack={activeView !== 'LOBBY'}
    >
      {/* ═══ LOBBY ═══ */}
      {activeView === 'LOBBY' && (
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-5 lg:items-start">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-4.5rem)] lg:overflow-y-auto lg:pb-4 no-scrollbar">
            <LeagueFilter
              leagues={leagues}
              selectedLeagueIds={selectedLeagueIds}
              onSelectLeagues={setSelectedLeagueIds}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </aside>
          {/* Main */}
          <div>
            {matchesLoading && <LoadingState message="Buscando partidas..." />}
            {matchesError && <ErrorState message={matchesError} onRetry={refreshMatches} />}
            {!matchesLoading && !matchesError && (
              <Lobby
                matches={matches}
                onSelectMatch={handleSelectMatch}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            )}

          </div>
        </div>
      )}

      {/* ═══ MATCH DETAIL ═══ */}
      {activeView === 'DATA' && (
        <div className="animate-in space-y-4">
          {detailLoading && <LoadingState message="Carregando dados..." />}
          {detailError && <ErrorState message={detailError} onRetry={refreshDetail} />}

          {!detailLoading && !detailError && matchDetail && (
            <>
              <Scoreboard data={matchDetail} />

              {/* ── Tab switcher ── */}
              <div className="flex gap-1 bg-surface/40 border border-outline-variant/20 rounded-xl p-1 max-w-[240px]">
                {(['stats', 'form'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveDataTab(tab)}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      activeDataTab === tab
                        ? 'bg-primary text-on-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]'
                        : 'text-on-surface-variant/55 hover:text-on-surface'
                    }`}
                  >
                    {tab === 'stats' ? 'Estatísticas' : 'Forma'}
                  </button>
                ))}
              </div>

              {/* ── Estatísticas tab ── */}
              {activeDataTab === 'stats' && (
                <>
                  {/* Filter Bar */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1">
                    {/* Count */}
                    {([5, 10, 15, 20, 999] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setStatsCount(n)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${statsCount === n ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                      >{n === 999 ? 'Todas' : n}</button>
                    ))}

                    <div className="h-5 w-px bg-outline-variant/20 flex-shrink-0" />

                    {/* Liga */}
                    <button
                      onClick={() => setLigaFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${ligaFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                    >Todas</button>
                    <button
                      onClick={() => setLigaFilter('game')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${ligaFilter === 'game' ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                    >{matchDetail.league?.name ? matchDetail.league.name.split(' ').slice(0, 2).join(' ') : 'Do Jogo'}</button>

                    <div className="h-5 w-px bg-outline-variant/20 flex-shrink-0" />

                    {/* Temporada */}
                    <button
                      onClick={() => setSeasonOnly(false)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${!seasonOnly ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                    >Sempre</button>
                    <button
                      onClick={() => setSeasonOnly(true)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${seasonOnly ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                    >Temporada</button>

                    <div className="h-5 w-px bg-outline-variant/20 flex-shrink-0" />

                    {/* Mando */}
                    <button
                      onClick={() => setMandoGame(false)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${!mandoGame ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                    >Todos</button>
                    <button
                      onClick={() => setMandoGame(true)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${mandoGame ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant/55 hover:text-on-surface'}`}
                    >Casa/Fora</button>

                    <div className="h-5 w-px bg-outline-variant/20 flex-shrink-0" />

                    {/* 100% */}
                    <button
                      onClick={() => setShow100Only(!show100Only)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all flex-shrink-0 text-[9px] font-black uppercase tracking-wider ${show100Only ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-outline-variant/30 bg-surface-container text-on-surface-variant/55 hover:text-on-surface'}`}
                    >🎯 100%</button>

                    {/* HT/2H/FT */}
                    <div className="flex items-center p-0.5 card flex-shrink-0">
                      {(['HT', '2H', 'FT'] as ToggleMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setToggle(mode)}
                          className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${toggle === mode ? 'bg-primary text-on-primary' : 'text-on-surface-variant/30 hover:text-on-surface'}`}
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

              {/* ── Forma tab ── */}
              {activeDataTab === 'form' && (
                <TeamFormTab
                  homeTeam={matchDetail.homeTeam}
                  awayTeam={matchDetail.awayTeam}
                  leagueDbId={matchDetail.fixture.league_id}
                  leagueName={matchDetail.league?.name ?? ''}
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
        <Odd20 mode="2.0" />
      )}

      {/* ═══ ODD 3.0 ═══ */}
      {activeView === 'ODD30' && (
        <Odd20 mode="3.0" />
      )}
    </Layout>
  );
}
