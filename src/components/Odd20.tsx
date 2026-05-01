/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, ChevronLeft, ChevronRight, Info, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── helpers ────────────────────────────────────────────────────────────────

const STAT_COL_FT: Record<string, string> = {
  'ESCANTEIOS': 'corners',
  'CARTÃO AMARELO': 'yellow_cards',
  'CHUTES': 'shots_total',
  'GOLS MARCADOS': 'goals_for',
};

const STAT_COL_JSONB: Record<string, string> = {
  'ESCANTEIOS': 'Corner Kicks',
  'CARTÃO AMARELO': 'Yellow Cards',
  'CHUTES': 'Total Shots',
};

function getActualVal(
  hist: any,
  stat: string,
  period: string,
  _teamTarget?: string,
  statKey?: string,
  liveScore?: any,
  histOther?: any // the other team's history (for TOTAL picks)
): number | undefined {
  // ── Novo formato: statKey (picks com odds reais) ──
  if (statKey) {
    const ftH  = liveScore?.home_score    ?? null;
    const ftA  = liveScore?.away_score    ?? null;
    const htH  = liveScore?.ht_home_score ?? null;
    const htA  = liveScore?.ht_away_score ?? null;
    const h2H  = (ftH != null && htH != null) ? ftH - htH : null;
    const h2A  = (ftA != null && htA != null) ? ftA - htA : null;

    switch (statKey) {
      // Gols totais por período
      case 'total_goals':
        return (ftH != null && ftA != null) ? ftH + ftA : undefined;
      case 'ht_total_goals':
        return (htH != null && htA != null) ? htH + htA : undefined;
      case '2h_total_goals':
        return (h2H != null && h2A != null) ? h2H + h2A : undefined;
      // Gols por equipe (FT)
      case 'home_score':  return ftH ?? undefined;
      case 'away_score':  return ftA ?? undefined;
      // Gols por equipe (1T)
      case 'ht_home_score': return htH ?? undefined;
      case 'ht_away_score': return htA ?? undefined;
      // Gols por equipe (2T = FT − HT)
      case '2h_home_score': return h2H ?? undefined;
      case '2h_away_score': return h2A ?? undefined;
      // Escanteios (usam histStats para dados finais)
      case 'total_corners':
        return (hist?.corners != null && histOther?.corners != null)
          ? hist.corners + histOther.corners : undefined;
      case 'home_corners': return hist?.corners ?? undefined;
      case 'away_corners': return hist?.corners ?? undefined;
      // Cartões
      case 'total_cards':
        return (hist?.yellow_cards != null && histOther?.yellow_cards != null)
          ? hist.yellow_cards + histOther.yellow_cards : undefined;
      default:
        return undefined;
    }
  }

  // ── Legado: picks históricos ──
  if (!hist) return undefined;
  if (period === 'FT') {
    const col = STAT_COL_FT[stat];
    return col !== undefined ? (hist[col] ?? undefined) : undefined;
  }
  const jsonbCol = period === 'HT' ? 'stats_1h' : 'stats_2h';
  const apiType = STAT_COL_JSONB[stat];
  if (!apiType) return undefined;
  const arr: any[] = hist[jsonbCol] || [];
  const found = arr.find((s: any) => s.type === apiType);
  if (!found || found.value === null || found.value === undefined) return 0;
  if (typeof found.value === 'string') return parseInt(found.value) || 0;
  return Number(found.value) || 0;
}

function evaluatePick(pick: any, actualVal: number | undefined): 'WON' | 'LOST' | null {
  if (actualVal === undefined || actualVal === null) return null;
  const threshold = parseFloat(String(pick.line).replace(/.*de\s+/i, ''));
  if (isNaN(threshold)) return null;
  const won = pick.type === 'OVER' ? actualVal > threshold : actualVal < threshold;
  return won ? 'WON' : 'LOST';
}

// ─── component ──────────────────────────────────────────────────────────────

export default function Odd20() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [dateOffset, setDateOffset] = useState(0);
  const [ticket, setTicket] = useState<any>(null);
  const [liveScores, setLiveScores] = useState<Record<number, any>>({});
  const [histStats, setHistStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ won: 0, lost: 0, pending: 0, avgOdd: '0.00' });

  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [stake, setStake] = useState('');

  const loadCurrentTicket = useCallback(async (offset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + offset);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const { data } = await supabase
      .from('odd_tickets')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();

    if (data) {
      setTicket(data);
      const ids: number[] = data.ticket_data.entries.map((e: any) => e.fixture_id);

      // Scores
      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('api_id, home_score, away_score, ht_home_score, ht_away_score, status')
        .in('api_id', ids);
      const scoreMap: Record<number, any> = {};
      fixtures?.forEach(f => { scoreMap[f.api_id] = f; });
      setLiveScores(scoreMap);

      // Stats from teams_history (keyed as "fixtureId-HOME" / "fixtureId-AWAY")
      const { data: histData } = await supabase
        .from('teams_history')
        .select('fixture_id, is_home, goals_for, corners, yellow_cards, shots_total, stats_1h, stats_2h')
        .in('fixture_id', ids);
      const hMap: Record<string, any> = {};
      histData?.forEach(h => { hMap[`${h.fixture_id}-${h.is_home ? 'HOME' : 'AWAY'}`] = h; });
      setHistStats(hMap);
    } else {
      setTicket(null);
      setHistStats({});
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await loadCurrentTicket(dateOffset);
      setLoading(false);
    }
    load();
  }, [dateOffset, loadCurrentTicket]);

  // Resolve & persist results once all games are finished
  useEffect(() => {
    if (!ticket || ticket.status !== 'PENDING') return;

    const entries: any[] = ticket.ticket_data.entries;
    const allFinished = entries.every(e => {
      const live = liveScores[e.fixture_id];
      return live?.status === 'FT';
    });
    if (!allFinished) return;

    // Check we have stats for at least one entry
    const hasStats = entries.some(e =>
      histStats[`${e.fixture_id}-HOME`] || histStats[`${e.fixture_id}-AWAY`]
    );
    if (!hasStats) return;

    // Build updated entries with pick results
    let ticketWon = true;
    const updatedEntries = entries.map(e => {
      let matchWon = true;
      const updatedPicks = e.picks.map((pick: any) => {
        if (pick.result) return pick;
        const hist = histStats[`${e.fixture_id}-HOME`];
        const histAway = histStats[`${e.fixture_id}-AWAY`];
        const liveScore = liveScores[e.fixture_id];
        const actual = getActualVal(
          pick.teamTarget === 'AWAY' ? histAway : hist,
          pick.stat, pick.period, pick.teamTarget, pick.statKey, liveScore,
          pick.teamTarget === 'TOTAL' ? histAway : undefined
        );
        const result = evaluatePick(pick, actual);
        if (result === 'LOST') matchWon = false;
        if (result !== 'WON') ticketWon = false;
        return { ...pick, result: result ?? pick.result };
      });
      if (!matchWon) ticketWon = false;
      return { ...e, result: matchWon ? 'WON' : 'LOST', picks: updatedPicks };
    });

    const newStatus = ticketWon ? 'WON' : 'LOST';
    const updatedTicketData = { ...ticket.ticket_data, entries: updatedEntries };

    // Persist to DB
    supabase
      .from('odd_tickets')
      .update({ status: newStatus, ticket_data: updatedTicketData })
      .eq('date', ticket.date)
      .then(({ error }) => {
        if (error) {
          console.warn('Could not persist ticket resolution:', error.message);
        }
      });

    // Update local state immediately regardless
    setTicket((prev: any) => ({
      ...prev,
      status: newStatus,
      ticket_data: updatedTicketData,
    }));
  }, [ticket, liveScores, histStats]);

  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase
        .from('odd_tickets')
        .select('*')
        .order('date', { ascending: false });
      if (data) {
        setAllTickets(data);
        const won = data.filter(t => t.status === 'WON').length;
        const lost = data.filter(t => t.status === 'LOST').length;
        const odds = data.filter(t => t.status === 'WON').map(t => parseFloat(t.total_odd));
        const avg = odds.length > 0
          ? (odds.reduce((a, b) => a + b, 0) / odds.length).toFixed(2)
          : '0.00';
        setStats({ won, lost, pending: data.filter(t => t.status === 'PENDING').length, avgOdd: avg });
      }
    }
    loadHistory();

    const tixChannel = supabase.channel('tix')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'odd_tickets' }, p => {
        setTicket((curr: any) => curr && p.new.date === curr.date ? p.new : curr);
        setAllTickets(prev => prev.map(t => t.date === p.new.date ? p.new : t));
      })
      .subscribe();

    const fixChannel = supabase.channel('fix')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fixtures' }, p => {
        setLiveScores(prev => ({ ...prev, [p.new.api_id]: p.new }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tixChannel);
      supabase.removeChannel(fixChannel);
    };
  }, []);

  const getCalendarData = () => {
    const start = new Date(calendarMonth.year, calendarMonth.month - 1, 1);
    const end = new Date(calendarMonth.year, calendarMonth.month, 0);
    const cells: any[] = [];
    for (let i = 0; i < start.getDay(); i++) cells.push(null);
    for (let i = 1; i <= end.getDate(); i++) {
      const dateStr = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const t = allTickets.find(x => x.date === dateStr);
      cells.push({ day: i, dateStr, status: t?.status });
    }
    return cells;
  };

  // Monthly stats filtered by selected calendar month
  const monthStats = (() => {
    const prefix = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}`;
    const monthTickets = allTickets.filter(t => t.date.startsWith(prefix) && t.matches_count > 0);
    const won = monthTickets.filter(t => t.status === 'WON').length;
    const lost = monthTickets.filter(t => t.status === 'LOST').length;
    const wonOdds = monthTickets.filter(t => t.status === 'WON').map(t => parseFloat(t.total_odd));
    const avgOdd = wonOdds.length > 0
      ? (wonOdds.reduce((a, b) => a + b, 0) / wonOdds.length).toFixed(2)
      : '0.00';

    const stakeVal = parseFloat(stake) || 0;
    const greenReturn = wonOdds.reduce((sum, odd) => sum + stakeVal * odd, 0);
    const totalInvested = (won + lost) * stakeVal;
    const profit = greenReturn - totalInvested;
    const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    return { won, lost, avgOdd, greenReturn, profit, roi };
  })();

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);
  const ty = targetDateObj.getFullYear();
  const tm = String(targetDateObj.getMonth() + 1).padStart(2, '0');
  const td = String(targetDateObj.getDate()).padStart(2, '0');
  const targetDateStr = `${ty}-${tm}-${td}`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 min-h-screen">
      {/* Tabs */}
      <div className="flex bg-surface-container/30 backdrop-blur-xl border border-outline-variant/10 rounded-2xl p-1.5 mb-12 max-w-sm mx-auto shadow-2xl relative z-50">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'today' ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'text-on-surface-variant hover:text-white'}`}
        >
          <Trophy className="w-4 h-4" />Sugestão
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'history' ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'text-on-surface-variant hover:text-white'}`}
        >
          <History className="w-4 h-4" />Histórico
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'today' ? (
          <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* Date nav */}
            <div className="flex justify-between items-center bg-surface-container/20 border border-outline-variant/10 rounded-2xl p-1.5 max-w-[280px] mx-auto mb-8">
              <button onClick={() => setDateOffset(prev => prev - 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-[11px] font-black uppercase tracking-tighter text-white">
                {dateOffset === 0 ? 'Hoje' : targetDateStr.split('-').reverse().slice(0, 2).join(' DE ')}
              </span>
              <button onClick={() => setDateOffset(prev => prev + 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center min-h-[30vh]">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
              </div>
            ) : !ticket || ticket.matches_count === 0 ? (
              <div className="text-center p-16 bg-surface border border-outline-variant/30 rounded-3xl max-w-lg mx-auto">
                <Info className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
                <h2 className="text-lg font-black text-on-surface mb-2">Sem sinais</h2>
                <p className="text-on-surface-variant text-xs">As métricas não atingiram a meta de 75%.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-12 relative">
                  <AnimatePresence>
                    {ticket.status === 'WON' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute -top-16 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[12px] font-black px-8 py-2 rounded-full shadow-[0_0_40px_rgba(16,185,129,0.8)] uppercase tracking-[0.2em] z-10 border border-white/20"
                      >
                        GREEN
                      </motion.div>
                    )}
                    {ticket.status === 'LOST' && (
                      <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute -top-16 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[12px] font-black px-8 py-2 rounded-full shadow-[0_0_40px_rgba(244,63,94,0.6)] uppercase tracking-[0.2em] z-10 border border-white/20"
                      >
                        💔 RED
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-2xl transition-all duration-700 ${
                    ticket.status === 'WON'
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_0_50px_rgba(16,185,129,0.5)] rotate-12 scale-110'
                      : ticket.status === 'LOST'
                        ? 'bg-gradient-to-br from-rose-400 to-rose-600 grayscale-[0.5]'
                        : 'bg-primary'
                  }`}>
                    <Trophy className={`w-8 h-8 text-white ${ticket.status === 'WON' ? 'animate-bounce' : ''}`} />
                  </div>

                  <h1 className={`text-6xl font-black italic tracking-tighter mb-4 uppercase transition-all duration-500 ${
                    ticket.status === 'WON' ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'text-white'
                  }`}>
                    ODD {ticket.total_odd}
                  </h1>

                  <div className={`inline-flex border rounded-full px-5 py-2 items-center gap-3 transition-all duration-500 ${
                    ticket.status === 'WON'
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : ticket.status === 'LOST'
                        ? 'bg-rose-500/10 border-rose-500/40'
                        : 'bg-surface-container/60 border-outline-variant/20'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      ticket.status === 'PENDING' ? 'bg-amber-400 animate-pulse' :
                      ticket.status === 'WON' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                      ticket.status === 'WON' ? 'text-emerald-400' :
                      ticket.status === 'LOST' ? 'text-rose-400' : 'text-on-surface-variant'
                    }`}>
                      {ticket.status === 'WON' ? 'Matemática Superada' :
                       ticket.status === 'LOST' ? 'Matemática Falhou' :
                       `Confiança IA: ${ticket.ticket_data.confidence_score}%`}
                    </span>
                  </div>
                </div>

                {/* Match cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ticket.ticket_data.entries.map((match: any, i: number) => {
                    const live = liveScores[match.fixture_id];
                    const isLive = live?.status && !['NS', 'TBD', 'FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD'].includes(live.status);
                    const isFinished = ['FT', 'AET', 'PEN'].includes(live?.status);

                    // Compute match result from picks
                    const picksWithResult = match.picks.map((pick: any) => {
                      if (pick.result) return { ...pick, computedResult: pick.result };
                      if (!isFinished) return { ...pick, computedResult: null };
                      const histH = histStats[`${match.fixture_id}-HOME`];
                      const histA = histStats[`${match.fixture_id}-AWAY`];
                      const hist = pick.teamTarget === 'AWAY' ? histA : histH;
                      const actual = getActualVal(
                        hist, pick.stat, pick.period, pick.teamTarget, pick.statKey, live,
                        pick.teamTarget === 'TOTAL' ? histA : undefined
                      );
                      return { ...pick, computedResult: evaluatePick(pick, actual), actual };
                    });

                    const matchResult = match.result
                      || (isFinished && picksWithResult.every(p => p.computedResult === 'WON') ? 'WON'
                        : isFinished && picksWithResult.some(p => p.computedResult === 'LOST') ? 'LOST'
                        : null);

                    return (
                      <div key={i} className={`border rounded-[32px] p-7 relative overflow-hidden group transition-all duration-500 shadow-xl ${
                        matchResult === 'WON'
                          ? 'bg-emerald-500/[0.03] border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.05)]'
                          : matchResult === 'LOST'
                            ? 'bg-rose-500/[0.03] border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.05)]'
                            : 'bg-surface/40 border-outline-variant/20'
                      }`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-2 transition-all duration-500 ${
                          matchResult === 'WON' ? 'bg-emerald-500' :
                          matchResult === 'LOST' ? 'bg-rose-500' : 'bg-primary'
                        }`} />

                        <div className="flex justify-between items-center mb-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-on-surface-variant bg-black/40 px-2.5 py-1 rounded-md uppercase tracking-tighter">
                              {new Date(match.date_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              {' - '}
                              {new Date(match.date_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isLive && (
                              <span className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/10 rounded-md">
                                <span className="w-1 h-1 bg-rose-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">AO VIVO</span>
                              </span>
                            )}
                          </div>
                          {matchResult && (
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-md ${matchResult === 'WON' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                              {matchResult}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-4 mb-8">
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <img src={match.homeLogo} className="w-8 h-8 object-contain" />
                            <span className="text-[10px] font-black text-white text-center line-clamp-1">{match.home}</span>
                          </div>
                          <div className="flex flex-col items-center">
                            {(isLive || isFinished) ? (
                              <span className="text-xl font-black text-white italic tabular-nums tracking-tighter">
                                {live.home_score} - {live.away_score}
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-on-surface-variant/20 italic">VS</span>
                            )}
                            {isLive && live?.status && (
                              <span className="text-[8px] font-black text-rose-500 mt-1">{live.status}</span>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-2 flex-1">
                            <img src={match.awayLogo} className="w-8 h-8 object-contain" />
                            <span className="text-[10px] font-black text-white text-center line-clamp-1">{match.away}</span>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {picksWithResult.map((pick: any, j: number) => {
                            const result = pick.computedResult;
                            const actual = pick.actual;
                            return (
                              <div key={j} className={`rounded-xl p-3.5 border transition-colors ${
                                result === 'WON'
                                  ? 'bg-emerald-500/10 border-emerald-500/30'
                                  : result === 'LOST'
                                    ? 'bg-rose-500/10 border-rose-500/30'
                                    : 'bg-black/30 border-white/5 group-hover:border-primary/20'
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">{pick.period}</span>
                                  <div className="flex items-center gap-2">
                                    {result && (
                                      <span className={`text-[9px] font-black ${result === 'WON' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {result === 'WON' ? '✓ GREEN' : '✗ RED'}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-black text-amber-500 tabular-nums">{pick.probability}%</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-end">
                                  <p className={`text-[11px] font-black leading-tight ${
                                    result === 'LOST' ? 'text-rose-400' :
                                    result === 'WON' ? 'text-emerald-400' : 'text-on-surface'
                                  }`}>
                                    {pick.team}: {pick.line} {pick.stat}
                                  </p>
                                  {actual !== undefined && (
                                    <span className={`text-[9px] font-black mb-0.5 tabular-nums ${
                                      result === 'WON' ? 'text-emerald-400' :
                                      result === 'LOST' ? 'text-rose-400' : 'text-on-surface-variant'
                                    }`}>
                                      FEZ: {actual}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            {/* Month Navigation */}
            <div className="flex justify-between items-center max-w-xs mx-auto">
              <button
                onClick={() => setCalendarMonth(prev => {
                  let m = prev.month - 1;
                  let y = prev.year;
                  if (m < 1) { m = 12; y -= 1; }
                  return { year: y, month: m };
                })}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-xl hover:bg-surface-container-highest/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-black uppercase tracking-tighter text-white">
                {new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCalendarMonth(prev => {
                  let m = prev.month + 1;
                  let y = prev.year;
                  if (m > 12) { m = 1; y += 1; }
                  return { year: y, month: m };
                })}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-xl hover:bg-surface-container-highest/20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 md:gap-4 mb-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[9px] font-black uppercase text-on-surface-variant/40 pb-2">{d}</div>
              ))}
              {getCalendarData().map((cell, i) => (
                <button
                  key={i}
                  disabled={!cell}
                  onClick={() => {
                    if (!cell) return;
                    setDateOffset(Math.round(
                      (new Date(cell.dateStr + 'T12:00:00').getTime() - new Date().setHours(12, 0, 0, 0)) / (1000 * 60 * 60 * 24)
                    ));
                    setActiveTab('today');
                  }}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${
                    !cell ? 'opacity-0' :
                    cell.status === 'WON' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' :
                    cell.status === 'LOST' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' :
                    cell.status === 'PENDING' ? 'bg-amber-500/5 animate-pulse border-amber-500/20' :
                    'bg-surface-container/20 border-outline-variant/10 text-on-surface-variant/20 hover:border-primary/40'
                  }`}
                >
                  {cell && <span className="text-sm font-black">{cell.day}</span>}
                </button>
              ))}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Greens', val: monthStats.won, color: 'text-emerald-400' },
                { label: 'Reds', val: monthStats.lost, color: 'text-rose-400' },
                { label: 'Taxa Acerto', val: `${Math.round((monthStats.won / (monthStats.won + monthStats.lost || 1)) * 100)}%`, color: 'text-white' },
                { label: 'Avg Odd', val: monthStats.avgOdd, color: 'text-primary' },
              ].map((s, i) => (
                <div key={i} className="bg-surface/50 p-5 rounded-2xl border border-outline-variant/20 text-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">{s.label}</span>
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>

            {/* Stake Simulator */}
            <div className="bg-surface/50 border border-outline-variant/20 rounded-2xl p-6 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                💰 Simulador de Stake
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-on-surface-variant">R$</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={stake}
                  onChange={e => setStake(e.target.value)}
                  placeholder="Ex: 100"
                  className="flex-1 bg-black/40 border border-outline-variant/20 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-primary/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              {stake && parseFloat(stake) > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-bold">Entradas no mês:</span>
                    <span className="text-white font-black">{monthStats.won + monthStats.lost}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-bold">Total investido:</span>
                    <span className="text-white font-black">R$ {((monthStats.won + monthStats.lost) * parseFloat(stake)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-400 font-bold">Retorno (Greens):</span>
                    <span className="text-emerald-400 font-black">+ R$ {monthStats.greenReturn.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-rose-400 font-bold">Perdas (Reds):</span>
                    <span className="text-rose-400 font-black">- R$ {(monthStats.lost * parseFloat(stake)).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-outline-variant/20 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-white">Resultado:</span>
                      <span className={`text-lg font-black ${monthStats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {monthStats.profit >= 0 ? '+' : ''} R$ {monthStats.profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase">ROI</span>
                      <span className={`text-xs font-black ${monthStats.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {monthStats.roi >= 0 ? '+' : ''}{monthStats.roi.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
