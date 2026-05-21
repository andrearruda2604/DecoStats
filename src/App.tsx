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
import OpportunitiesTab from './components/OpportunitiesTab';
import LeagueFilter from './components/LeagueFilter';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import LoginPage from './components/LoginPage';
import TestView from './components/TestView';
import PrivacyPage from './components/PrivacyPage';
import TeamFormTab from './components/TeamFormTab';
import StandingsTab from './components/StandingsTab';
import { useMatches } from './hooks/useMatches';
import { useMatchStats } from './hooks/useMatchStats';
import { useAuth } from './contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import type { ToggleMode } from './types';
import { fetchPredictiveData, fetchStandings } from './services/api';

const VERSION = '1.0.2-live-engine';

export default function App() {
  // Public route — no auth required
  if (window.location.pathname === '/privacidade') {
    return <PrivacyPage />;
  }

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
  const [lastListView, setLastListView] = useState<'LOBBY' | 'ODD20' | 'ODD30' | 'ODD40' | 'OPP'>('LOBBY');


  const [predictiveBlock, setPredictiveBlock] = useState<any>(null);
  const [predictiveLoading, setPredictiveLoading] = useState(false);
  const [activeDataTab, setActiveDataTab] = useState<'stats' | 'form' | 'table'>('stats');
  const [teamRanks, setTeamRanks] = useState<{ home: number | null; away: number | null }>({ home: null, away: null });

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
    } else if (activeView === 'ODD40') {
      setOddScrollPos(window.scrollY);
      setLastListView('ODD40');
    } else if (activeView === 'OPP') {
      setOddScrollPos(window.scrollY);
      setLastListView('OPP');
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
      } else if (activeView === 'ODD20' || activeView === 'ODD30' || activeView === 'ODD40' || activeView === 'OPP') {
        setActiveView('LOBBY');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeView, lastListView]);

  useEffect(() => {
    if (activeView === 'LOBBY') {
      setTimeout(() => window.scrollTo(0, lobbyScrollPos), 10);
    } else if (activeView === 'ODD20' || activeView === 'ODD30' || activeView === 'ODD40' || activeView === 'OPP') {
      setTimeout(() => window.scrollTo(0, oddScrollPos), 10);
    }
  }, [activeView, lobbyScrollPos, oddScrollPos]);

  useEffect(() => {
    localStorage.setItem('decostats_sort_by', sortBy);
  }, [sortBy]);

  // Fetch team rankings from standings when match detail loads
  useEffect(() => {
    if (!matchDetail) { setTeamRanks({ home: null, away: null }); return; }
    const leagueId = matchDetail.fixture.league_id;
    const season   = matchDetail.fixture?.season || matchDetail.league?.season;
    if (!leagueId || !season) return;
    fetchStandings(leagueId, season).then(rows => {
      const homeRow = rows.find(r => r.team_api_id === matchDetail.homeTeam.api_id);
      const awayRow = rows.find(r => r.team_api_id === matchDetail.awayTeam.api_id);
      setTeamRanks({ home: homeRow?.rank ?? null, away: awayRow?.rank ?? null });
    }).catch(() => setTeamRanks({ home: null, away: null }));
  }, [matchDetail]);


  useEffect(() => {
    let isMounted = true;
    if (matchDetail) {
      setPredictiveLoading(true);
      fetchPredictiveData(matchDetail.homeTeam.api_id, matchDetail.awayTeam.api_id, statsCount, {
        seasonOnly: seasonOnly,
        mandoOnly: mandoGame,
        leagueId: ligaFilter === 'game' ? matchDetail.fixture?.league_id : undefined,
        season: matchDetail.fixture?.season || matchDetail.league?.season,
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
              <Scoreboard data={matchDetail} homeRank={teamRanks.home} awayRank={teamRanks.away} />

              {/* ── Tab switcher ── */}
              <div className="flex overflow-x-auto no-scrollbar border-b border-outline-variant/20 text-sm font-semibold text-on-surface-variant/60">
                {(['stats', 'form', 'table'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveDataTab(tab)}
                    className={`relative px-4 py-3 whitespace-nowrap transition-colors ${
                      activeDataTab === tab
                        ? 'text-on-surface'
                        : 'hover:text-on-surface-variant'
                    }`}
                  >
                    {tab === 'stats' ? 'Estatísticas' : tab === 'form' ? 'Forma' : 'Tabela'}
                    {activeDataTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-md" />
                    )}
                  </button>
                ))}
              </div>

              {/* ── Estatísticas tab ── */}
              {activeDataTab === 'stats' && (
                <>
                  {/* Filter Bar */}
                  <div className="bg-surface-container/30 rounded-2xl p-4 mb-4 border border-outline-variant/10">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      
                      {/* Left Column */}
                      <div className="space-y-5">
                        {/* Partidas */}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2.5 block">Partidas</span>
                          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                            {([5, 10, 15, 20, 999] as const).map(n => {
                              const isActive = statsCount === n;
                              return (
                                <button
                                  key={n}
                                  onClick={() => setStatsCount(n)}
                                  className={`relative text-[11px] font-bold transition-colors whitespace-nowrap ${isActive ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                                >
                                  {n === 999 ? 'Todas' : n}
                                  {isActive && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Local */}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2.5 block">Local</span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setMandoGame(false)}
                              className={`relative text-[11px] font-bold transition-colors ${!mandoGame ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                            >
                              Todos
                              {!mandoGame && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                            </button>
                            <button
                              onClick={() => setMandoGame(true)}
                              className={`relative text-[11px] font-bold transition-colors ${mandoGame ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                            >
                              Casa/Fora
                              {mandoGame && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                            </button>
                          </div>
                        </div>

                        {/* Tempo */}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2.5 block">Tempo</span>
                          <div className="flex items-center gap-4">
                            {(['HT', '2H', 'FT'] as ToggleMode[]).map((mode) => {
                              const isActive = toggle === mode;
                              return (
                                <button
                                  key={mode}
                                  onClick={() => setToggle(mode)}
                                  className={`relative text-[11px] font-bold transition-colors ${isActive ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                                >
                                  {mode === 'HT' ? '1° Tempo' : mode === 'FT' ? 'Jogo' : '2° Tempo'}
                                  {isActive && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-5">
                        {/* Ligas */}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 mb-2.5 block">Ligas</span>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => setLigaFilter('all')}
                              className={`relative text-[11px] font-bold transition-colors ${ligaFilter === 'all' ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                            >
                              Todas
                              {ligaFilter === 'all' && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                            </button>
                            <button
                              onClick={() => setLigaFilter('game')}
                              className={`relative text-[11px] font-bold transition-colors ${ligaFilter === 'game' ? 'text-primary' : 'text-on-surface-variant/60 hover:text-on-surface'}`}
                            >
                              {matchDetail.league?.name ? matchDetail.league.name.split(' ').slice(0, 2).join(' ') : 'Do Jogo'}
                              {ligaFilter === 'game' && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                            </button>
                          </div>
                        </div>

                        {/* Temporada Switch */}
                        <div className="pt-1">
                          <label className="flex items-center gap-3 cursor-pointer select-none group">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={seasonOnly}
                                onChange={(e) => setSeasonOnly(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-10 h-5 bg-surface-container border border-outline-variant/30 rounded-full peer peer-checked:bg-primary transition-colors" />
                              <div className="absolute left-1 top-1 w-3 h-3 bg-on-surface-variant/50 rounded-full peer-checked:translate-x-5 peer-checked:bg-on-primary transition-transform" />
                            </div>
                            <span className="text-[10px] leading-tight w-24 text-on-surface-variant group-hover:text-on-surface transition-colors">
                              Ignorar partidas da temporada anterior
                            </span>
                          </label>
                        </div>

                        {/* 100% Button */}
                        <div className="pt-2">
                          <button
                            onClick={() => setShow100Only(!show100Only)}
                            className={`flex items-center justify-center w-full max-w-[140px] py-2.5 rounded-lg border transition-all text-[10px] font-black uppercase tracking-wider ${show100Only ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-outline-variant/20 bg-surface/30 text-on-surface-variant hover:text-on-surface'}`}
                          >
                            🎯 Mostrar só 100%
                          </button>
                        </div>
                      </div>

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
                  season={matchDetail.fixture?.season || matchDetail.league?.season}
                />
              )}

              {/* ── Tabela tab ── */}
              {activeDataTab === 'table' && (
                <StandingsTab
                  leagueId={matchDetail.fixture.league_id}
                  season={matchDetail.fixture?.season || matchDetail.league?.season}
                  leagueName={matchDetail.league?.name}
                  homeTeamApiId={matchDetail.homeTeam.api_id}
                  awayTeamApiId={matchDetail.awayTeam.api_id}
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

      {/* ═══ OPORTUNIDADES DO DIA ═══ */}
      {activeView === 'OPP' && (
        <OpportunitiesTab onSelectMatch={handleSelectMatch} />
      )}

      {/* ═══ ODD 4.0 ═══ */}
      {activeView === 'ODD40' && (
        <div className="space-y-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/60 mb-4">Bilhete A</p>
            <Odd20 mode="4.0a" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/60 mb-4">Bilhete B</p>
            <Odd20 mode="4.0b" />
          </div>
        </div>
      )}
    </Layout>
  );
}
