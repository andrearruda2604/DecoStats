import { useEffect, useState, useMemo } from 'react';
import { Crown, ChevronLeft, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { fetchMatches } from '../services/api';
import type { League, ToggleMode } from '../types';

interface TopsTabProps {
  onSelectMatch?: (id: number) => void;
  leagues?: League[];
}


interface TeamStat {
  teamId: number;
  teamName: string;
  teamLogo: string;
  fixtureId: number;
  isHome: boolean;
  value: number;
}

const CRITERIA = [
  { id: 'goals', label: 'Gols', flatKey: 'goals_for', apiType: 'goals' },
  { id: 'corners', label: 'Escanteios', flatKey: 'corners', apiType: 'Corner Kicks' },
  { id: 'cards', label: 'Cartões', flatKey: 'yellow_cards', apiType: 'Yellow Cards' }, // We'll add Red Cards manually
  { id: 'shots_target', label: 'Chutes no Gol', flatKey: 'shots_on_goal', apiType: 'Shots on Goal' },
  { id: 'shots_total', label: 'Chutes Totais', flatKey: 'shots_total', apiType: 'Total Shots' }
];

function todayBrt() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function fmtDisplayDate(d: string) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function extractStatFromJsonb(jsonbArr: any[], apiType: string): number {
  if (!jsonbArr || jsonbArr.length === 0) return 0;
  const found = jsonbArr.find((s: any) => s.type === apiType);
  if (!found || found.value === null || found.value === undefined) return 0;
  if (typeof found.value === 'string' && found.value.includes('%')) return parseInt(found.value.replace('%', ''), 10);
  return parseInt(found.value, 10) || 0;
}

export default function TopsTab({ onSelectMatch, leagues }: TopsTabProps) {
  const [targetDate, setTargetDate] = useState(todayBrt());
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<ToggleMode>('FT');
  const [teamsData, setTeamsData] = useState<Record<string, TeamStat[]>>({});
  
  // Store raw history to avoid refetching when filters change
  const [rawHistory, setRawHistory] = useState<any[]>([]);
  const [teamMap, setTeamMap] = useState<Map<number, { name: string; logoUrl: string; fixtureId: number; isHome: boolean; season: number; leagueId: number }>>(new Map());

  // 1. Fetch matches and history when date changes
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const matches = await fetchMatches(targetDate);
        if (matches.length === 0) {
          setRawHistory([]);
          setTeamMap(new Map());
          setLoading(false);
          return;
        }

        const tMap = new Map<number, { name: string; logoUrl: string; fixtureId: number; isHome: boolean; season: number; leagueId: number }>();
        const teamIds = new Set<number>();

        matches.forEach(m => {
          teamIds.add(m.homeTeam.id);
          teamIds.add(m.awayTeam.id);
          tMap.set(m.homeTeam.id, { name: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl, fixtureId: m.id, isHome: true, season: m.league.season, leagueId: m.league.id });
          tMap.set(m.awayTeam.id, { name: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl, fixtureId: m.id, isHome: false, season: m.league.season, leagueId: m.league.id });
        });

        const allTeamIds = Array.from(teamIds);
        
        const { data: history, error } = await supabase
          .from('teams_history')
          .select('team_id, season, league_id, is_home, match_date, goals_for, corners, yellow_cards, red_cards, shots_total, shots_on_goal, stats_ft, stats_1h, stats_2h')
          .in('team_id', allTeamIds)
          .order('match_date', { ascending: false });

        if (error) {
          console.error("Error fetching teams history:", error);
        } else {
          setTeamMap(tMap);
          setRawHistory(history || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [targetDate]);

  // 2. Process data when filters or raw history change
  useEffect(() => {
    if (rawHistory.length === 0) {
      setTeamsData({});
      return;
    }

    const historyByTeam = new Map<number, any[]>();
    rawHistory.forEach(row => {
      if (!historyByTeam.has(row.team_id)) historyByTeam.set(row.team_id, []);
      historyByTeam.get(row.team_id)!.push(row);
    });

    const computedData: Record<string, TeamStat[]> = { goals: [], corners: [], cards: [], shots_target: [], shots_total: [] };
    const allTeamIds = Array.from(teamMap.keys());

    allTeamIds.forEach(teamId => {
      const teamInfo = teamMap.get(teamId)!;
      let th = historyByTeam.get(teamId) || [];

      // Regra de criação de bilhetes: considera campeonato, mando, e mínimo de jogos
      if (teamInfo.isHome) {
        th = th.filter(h => h.is_home && h.season === teamInfo.season && h.league_id === teamInfo.leagueId);
      } else {
        th = th.filter(h => !h.is_home && h.season === teamInfo.season && h.league_id === teamInfo.leagueId);
      }

      // Take last 20 matching games
      const filtered = th.slice(0, 20);
      // Require at least 7 games to be considered in the ranking
      if (filtered.length < 7) return;

      CRITERIA.forEach(crit => {
        let sum = 0;
        let validCount = 0;

        filtered.forEach(h => {
          let val = 0;

          if (periodFilter === 'FT') {
            if (crit.id === 'cards') {
              val = (h.yellow_cards || 0) + (h.red_cards || 0);
            } else {
              val = (h[crit.flatKey] || 0);
            }
          } else {
            // HT or 2H
            const jsonbCol = periodFilter === 'HT' ? h.stats_1h : h.stats_2h;
            if (jsonbCol) {
              if (crit.id === 'cards') {
                val = extractStatFromJsonb(jsonbCol, 'Yellow Cards') + extractStatFromJsonb(jsonbCol, 'Red Cards');
              } else {
                val = extractStatFromJsonb(jsonbCol, crit.apiType);
              }
            }
          }

          sum += val;
          validCount++;
        });

        if (validCount > 0) {
          computedData[crit.id].push({
            teamId,
            teamName: teamInfo.name,
            teamLogo: teamInfo.logoUrl,
            fixtureId: teamInfo.fixtureId,
            isHome: teamInfo.isHome,
            value: sum / validCount
          });
        }
      });
    });

    // Sort each criteria descending and keep top 10
    CRITERIA.forEach(crit => {
      computedData[crit.id].sort((a, b) => b.value - a.value);
      computedData[crit.id] = computedData[crit.id].slice(0, 10);
    });

    setTeamsData(computedData);

  }, [rawHistory, periodFilter, teamMap]);

  function changeDate(delta: number) {
    if (!targetDate) return;
    const d = new Date(targetDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setTargetDate(d.toISOString().split('T')[0]);
  }

  return (
    <div className="space-y-8 animate-in w-full max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container/30 p-4 md:p-6 rounded-3xl border border-outline-variant/10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-on-surface flex items-center gap-2">
                Tops do Dia
                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">TOP 10</span>
              </h2>
              <p className="text-xs text-on-surface-variant/60 font-medium">As maiores médias do dia em cada critério</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-surface/50 w-fit rounded-xl p-1 border border-outline-variant/10">
            <button onClick={() => changeDate(-1)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-400 hover:bg-rose-500/10 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-black text-on-surface min-w-[140px] text-center">
              {targetDate === todayBrt() ? (
                <span className="text-rose-400">{fmtDisplayDate(targetDate)} <span className="text-[10px] font-bold opacity-60">hoje</span></span>
              ) : (
                fmtDisplayDate(targetDate)
              )}
            </span>
            <button onClick={() => changeDate(1)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-rose-400 hover:bg-rose-500/10 transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 relative z-10 w-full md:w-auto">
          {/* Time Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50 ml-1">Período</span>
            <div className="flex bg-surface/60 p-1.5 rounded-xl border border-outline-variant/10 shadow-inner">
              {(['HT', 'FT', '2H'] as ToggleMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPeriodFilter(mode)}
                  className={`flex-1 md:px-5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                    periodFilter === mode ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {mode === 'HT' ? '1° Tempo' : mode === 'FT' ? 'Jogo' : '2° Tempo'}
                </button>
              ))}
            </div>
          </div>


        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent animate-spin rounded-full" />
        </div>
      ) : Object.keys(teamsData).length === 0 ? (
        <div className="text-center py-20 bg-surface border border-outline-variant/10 rounded-3xl">
          <Activity className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
          <h3 className="text-lg font-black text-on-surface mb-2">Sem dados para este dia</h3>
          <p className="text-sm text-on-surface-variant">Selecione outra data com jogos disponíveis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {CRITERIA.map(crit => {
            const list = teamsData[crit.id] || [];
            if (list.length === 0) return null;

            return (
              <div key={crit.id} className="bg-surface-container/20 rounded-3xl p-5 border border-outline-variant/10 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-rose-500/10 transition-all duration-500" />
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center border border-outline-variant/20 shadow-sm">
                      <TrendingUp className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">{crit.label}</h3>
                      <span className="text-[10px] text-on-surface-variant font-medium">Média Total {periodFilter}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 relative z-10">
                  {list.map((team, idx) => (
                    <div
                      key={team.teamId}
                      onClick={() => onSelectMatch?.(team.fixtureId)}
                      className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-300 ${
                        idx === 0
                          ? 'bg-gradient-to-r from-surface to-surface-container shadow-lg border border-rose-500/20 hover:border-rose-500/40 transform hover:-translate-y-0.5'
                          : 'bg-surface/50 border border-outline-variant/5 hover:bg-surface hover:border-outline-variant/20'
                      }`}
                    >
                      {/* Rank Number / Crown */}
                      <div className="relative w-8 flex justify-center shrink-0">
                        {idx === 0 ? (
                          <div className="relative">
                            <Crown className="absolute -top-3.5 -right-2 w-5 h-5 text-amber-400 drop-shadow-md z-10 animate-pulse" />
                            <div className="w-7 h-7 rounded-full bg-white text-black font-black text-xs flex items-center justify-center shadow-lg border border-outline-variant/10">
                              1
                            </div>
                          </div>
                        ) : (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border ${
                            idx < 3 ? 'bg-surface text-on-surface shadow-sm border-outline-variant/20' : 'bg-transparent text-on-surface-variant border-transparent'
                          }`}>
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Team Logo & Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white/5 p-1 shrink-0 flex items-center justify-center">
                          <img src={team.teamLogo} alt={team.teamName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex flex-col truncate">
                          <span className={`text-sm font-black truncate ${idx === 0 ? 'text-on-surface' : 'text-on-surface/90'}`}>
                            {team.teamName}
                          </span>
                          <span className="text-[9px] font-bold text-on-surface-variant/50 uppercase tracking-wider flex items-center gap-1">
                            {team.isHome ? (
                              <><span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Casa</>
                            ) : (
                              <><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Fora</>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Value */}
                      <div className="shrink-0 text-right">
                        <span className={`font-black tracking-tighter ${
                          idx === 0 ? 'text-2xl text-rose-400' : 'text-xl text-on-surface'
                        }`}>
                          {team.value.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
