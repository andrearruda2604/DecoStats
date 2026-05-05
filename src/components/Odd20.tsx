/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, ChevronLeft, ChevronRight, Info, History, TrendingUp, X, BarChart2, ExternalLink } from 'lucide-react';
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
  histOther?: any
): number | undefined {
  if (statKey) {
    const ftH  = liveScore?.home_score    ?? null;
    const ftA  = liveScore?.away_score    ?? null;
    const htH  = liveScore?.ht_home_score ?? null;
    const htA  = liveScore?.ht_away_score ?? null;
    const h2H  = (ftH != null && htH != null) ? ftH - htH : null;
    const h2A  = (ftA != null && htA != null) ? ftA - htA : null;

    switch (statKey) {
      case 'total_goals':      return (ftH != null && ftA != null) ? ftH + ftA : undefined;
      case 'ht_total_goals':   return (htH != null && htA != null) ? htH + htA : undefined;
      case '2h_total_goals':   return (h2H != null && h2A != null) ? h2H + h2A : undefined;
      case 'home_score':       return ftH ?? undefined;
      case 'away_score':       return ftA ?? undefined;
      case 'ht_home_score':    return htH ?? undefined;
      case 'ht_away_score':    return htA ?? undefined;
      case '2h_home_score':    return h2H ?? undefined;
      case '2h_away_score':    return h2A ?? undefined;
      case 'total_corners':
        return (hist?.corners != null && histOther?.corners != null)
          ? hist.corners + histOther.corners : undefined;
      case 'home_corners':     return hist?.corners ?? undefined;
      case 'away_corners':     return hist?.corners ?? undefined;
      case 'total_cards':
        return (hist?.yellow_cards != null && histOther?.yellow_cards != null)
          ? hist.yellow_cards + histOther.yellow_cards : undefined;
      default: return undefined;
    }
  }

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

function getHistStatValue(game: any, pick: any): number | null {
  const { stat, period } = pick;
  if (stat === 'GOLS') {
    if (period === 'FT') return game.goals_for ?? null;
    if (period === 'HT') {
      const g = game.stats_1h?.find((s: any) => s.type === 'goals');
      return g != null ? (typeof g.value === 'string' ? parseInt(g.value) : g.value) ?? 0 : null;
    }
    if (period === '2H') {
      const g = game.stats_2h?.find((s: any) => s.type === 'goals');
      return g != null ? (typeof g.value === 'string' ? parseInt(g.value) : g.value) ?? 0 : null;
    }
  }
  if (stat === 'ESCANTEIOS') {
    if (period === 'FT') return game.corners ?? null;
    if (period === 'HT') {
      const ck = game.stats_1h?.find((s: any) => s.type === 'Corner Kicks');
      return ck != null ? (typeof ck.value === 'string' ? parseInt(ck.value) : ck.value) ?? 0 : null;
    }
  }
  if (stat === 'CARTÕES') {
    const yc = game.stats_ft?.find((s: any) => s.type === 'Yellow Cards');
    const rc = game.stats_ft?.find((s: any) => s.type === 'Red Cards');
    return (yc?.value ?? 0) + (rc?.value ?? 0);
  }
  return null;
}

// ─── Balance Evolution Chart ─────────────────────────────────────────────────

function BalanceChart({ data }: { data: { date: string; balance: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-on-surface-variant/30 text-[10px] font-black uppercase tracking-widest text-center leading-loose">
        Sem dados<br />no período
      </div>
    );
  }

  const W = 400, H = 140, PX = 8, PY = 14;
  const allVals = [0, ...data.map(d => d.balance)];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;

  const toX = (i: number) => PX + (i / Math.max(data.length - 1, 1)) * (W - PX * 2);
  const toY = (v: number) => PY + (1 - (v - min) / span) * (H - PY * 2);

  const zeroY = toY(0);
  const lastVal = data[data.length - 1].balance;
  const positive = lastVal >= 0;
  const color = positive ? '#10b981' : '#f43f5e';
  const fillColor = positive ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)';

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.balance)}`).join(' ');
  const area = data.length > 1
    ? `M${toX(0)},${zeroY} L${toX(0)},${toY(data[0].balance)} ${data.slice(1).map((d, i) => `L${toX(i + 1)},${toY(d.balance)}`).join(' ')} L${toX(data.length - 1)},${zeroY} Z`
    : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        <line x1={PX} y1={zeroY} x2={W - PX} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,4" />
        {area && <path d={area} fill={fillColor} />}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={toX(data.length - 1)} cy={toY(lastVal)} r="3.5" fill={color} />
      </svg>
      <div className="flex justify-between items-center px-1 mt-1">
        <span className="text-[8px] text-on-surface-variant/40 font-bold">{data[0].date.slice(5).replace('-', '/')}</span>
        <span className={`text-[10px] font-black ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {lastVal >= 0 ? '+' : ''}R$ {lastVal.toFixed(2)}
        </span>
        <span className="text-[8px] text-on-surface-variant/40 font-bold">{data[data.length - 1].date.slice(5).replace('-', '/')}</span>
      </div>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

interface TicketModeProps {
  mode: '2.0' | '3.0';
}

export default function Odd20({ mode = '2.0' }: TicketModeProps) {

  const [activeTab, setActiveTab] = useState<'today' | 'history'>(() =>
    (localStorage.getItem(`decostats_odd_tab_${mode}`) as 'today' | 'history') || 'today'
  );
  const [dateOffset, setDateOffset] = useState(0);
  const [ticket, setTicket] = useState<any>(null);
  const [liveScores, setLiveScores] = useState<Record<number, any>>({});
  const [histStats, setHistStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [allTickets, setAllTickets] = useState<any[]>([]);

  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const saved = localStorage.getItem(`decostats_calendar_${mode}`);
    if (saved) return JSON.parse(saved);
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [stake, setStake] = useState(() =>
    localStorage.getItem(`decostats_stake_${mode}`) || ''
  );
  const [rangeStart, setRangeStart] = useState<string>(() =>
    localStorage.getItem(`decostats_range_start_${mode}`) || ''
  );
  const [rangeEnd, setRangeEnd] = useState<string>(() =>
    localStorage.getItem(`decostats_range_end_${mode}`) || ''
  );

  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [entryHomeHistory, setEntryHomeHistory] = useState<any[]>([]);
  const [entryAwayHistory, setEntryAwayHistory] = useState<any[]>([]);
  const [entryHistLoading, setEntryHistLoading] = useState(false);

  // Persist state
  useEffect(() => {
    localStorage.setItem(`decostats_odd_tab_${mode}`, activeTab);
  }, [activeTab, mode]);

  useEffect(() => {
    localStorage.setItem(`decostats_calendar_${mode}`, JSON.stringify(calendarMonth));
  }, [calendarMonth, mode]);

  useEffect(() => {
    localStorage.setItem(`decostats_stake_${mode}`, stake);
  }, [stake, mode]);

  useEffect(() => {
    localStorage.setItem(`decostats_range_start_${mode}`, rangeStart);
  }, [rangeStart, mode]);

  useEffect(() => {
    localStorage.setItem(`decostats_range_end_${mode}`, rangeEnd);
  }, [rangeEnd, mode]);

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
      .eq('mode', mode)
      .maybeSingle();

    if (data) {
      setTicket(data);
      const ids: number[] = data.ticket_data.entries.map((e: any) => e.fixture_id);

      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('api_id, home_score, away_score, ht_home_score, ht_away_score, status')
        .in('api_id', ids);
      const scoreMap: Record<number, any> = {};
      fixtures?.forEach(f => { scoreMap[f.api_id] = f; });
      setLiveScores(scoreMap);

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

  const loadEntryHistory = useCallback(async (entry: any, ticketDate: string) => {
    setEntryHistLoading(true);
    setEntryHomeHistory([]);
    setEntryAwayHistory([]);

    const { data: fix } = await supabase
      .from('fixtures')
      .select('home_team_id, away_team_id')
      .eq('api_id', entry.fixture_id)
      .maybeSingle();

    if (!fix) { setEntryHistLoading(false); return; }

    // Use the game's own kickoff time as the cutoff so the drawer shows
    // exactly the history that existed when the pick was generated.
    const cutoff = entry.date_time;
    const [{ data: homeHist }, { data: awayHist }] = await Promise.all([
      supabase
        .from('teams_history')
        .select('fixture_id, match_date, is_home, goals_for, goals_against, corners, yellow_cards, red_cards, stats_1h, stats_2h, stats_ft')
        .eq('team_id', fix.home_team_id)
        .lt('match_date', cutoff)
        .order('match_date', { ascending: false })
        .limit(20),
      supabase
        .from('teams_history')
        .select('fixture_id, match_date, is_home, goals_for, goals_against, corners, yellow_cards, red_cards, stats_1h, stats_2h, stats_ft')
        .eq('team_id', fix.away_team_id)
        .lt('match_date', cutoff)
        .order('match_date', { ascending: false })
        .limit(20),
    ]);

    setEntryHomeHistory(homeHist || []);
    setEntryAwayHistory(awayHist || []);
    setEntryHistLoading(false);
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

    const hasStats = entries.some(e =>
      histStats[`${e.fixture_id}-HOME`] || histStats[`${e.fixture_id}-AWAY`]
    );
    if (!hasStats) return;

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

    supabase
      .from('odd_tickets')
      .update({ status: newStatus, ticket_data: updatedTicketData })
      .eq('date', ticket.date)
      .eq('mode', mode)
      .then(({ error }) => {
        if (error) console.warn('Could not persist ticket resolution:', error.message);
      });

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
        .eq('mode', mode)
        .order('date', { ascending: false });

      if (data) {
        setAllTickets(data);

        const currentPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const hasCurrentMonth = data.some(t => t.date.startsWith(currentPrefix));
        const savedMonth = localStorage.getItem(`decostats_calendar_${mode}`);

        if (!hasCurrentMonth && data.length > 0 && !savedMonth) {
          const lastDate = new Date(data[0].date);
          setCalendarMonth({ year: lastDate.getFullYear(), month: lastDate.getMonth() + 1 });
        }
      }
    }
    loadHistory();

    const tixChannel = supabase.channel('tix')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'odd_tickets' }, p => {
        if (p.new.mode !== mode) return;
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

  // ─── Range-based computations ─────────────────────────────────────────────

  const defaultRangeStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultRangeEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

  const effectiveStart = rangeStart || defaultRangeStart;
  const effectiveEnd = rangeEnd || defaultRangeEnd;

  const rangeTickets = [...allTickets]
    .filter(t => t.date >= effectiveStart && t.date <= effectiveEnd && t.matches_count > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const rangeStats = (() => {
    const won = rangeTickets.filter(t => t.status === 'WON').length;
    const lost = rangeTickets.filter(t => t.status === 'LOST').length;

    let maxGreen = 0, curGreen = 0, maxLoss = 0, curLoss = 0;
    for (const t of rangeTickets.filter(t => t.status === 'WON' || t.status === 'LOST')) {
      if (t.status === 'WON') { curGreen++; curLoss = 0; }
      else { curLoss++; curGreen = 0; }
      maxGreen = Math.max(maxGreen, curGreen);
      maxLoss = Math.max(maxLoss, curLoss);
    }

    const stakeVal = parseFloat(stake) || 0;
    const wonOdds = rangeTickets.filter(t => t.status === 'WON').map(t => parseFloat(t.total_odd));
    const totalReturn = wonOdds.reduce((sum, odd) => sum + stakeVal * odd, 0);
    const totalInvested = (won + lost) * stakeVal;
    const profit = totalReturn - totalInvested;
    const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    // Lógica sugerida pelo usuário: Green (Lucro Líquido) e Red (Stake Perdida)
    const netGreens = totalReturn - (won * stakeVal);
    const redLoss = lost * stakeVal;

    return { won, lost, maxGreen, maxLoss, totalReturn, totalInvested, profit, roi, netGreens, redLoss };
  })();

  const balanceData = (() => {
    const stakeVal = parseFloat(stake) || 0;
    if (stakeVal === 0) return [] as { date: string; balance: number }[];
    let running = 0;
    const points: { date: string; balance: number }[] = [];
    for (const t of rangeTickets.filter(t => t.status === 'WON' || t.status === 'LOST')) {
      running += t.status === 'WON'
        ? stakeVal * parseFloat(t.total_odd) - stakeVal
        : -stakeVal;
      points.push({ date: t.date, balance: running });
    }
    return points;
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
                <p className="text-on-surface-variant text-xs">As métricas não atingiram a meta de 85%.</p>
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
                    {mode === '3.0' ? 'PREMIUM' : 'ODD'} {ticket.total_odd}
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
                      <div
                        key={i}
                        onClick={() => { setSelectedEntry(match); loadEntryHistory(match, ticket.date); }}
                        className={`border rounded-[32px] p-7 relative overflow-hidden group transition-all duration-500 shadow-xl cursor-pointer hover:scale-[1.01] ${
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
                          <div className="flex items-center gap-2">
                            {matchResult && (
                              <span className={`text-[9px] font-black px-2.5 py-1 rounded-md ${matchResult === 'WON' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                {matchResult}
                              </span>
                            )}
                            {/* Link direto Bet365 */}
                            <a
                              href={`https://www.bet365.com.br/#/AC/B1/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              title="Apostar na bet365"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-white hover:opacity-100 opacity-80 transition-opacity"
                              style={{ background: '#00884c' }}
                            >
                              <span className="text-[8px] font-black tracking-tight">bet365</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
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
          /* ─── Histórico 2.0 — novo layout 2×2 ─────────────────────────── */
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── Top-left: Calendário ─────────────────────────────────── */}
              <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-5">
                {/* Month nav */}
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => setCalendarMonth(prev => {
                      let m = prev.month - 1, y = prev.year;
                      if (m < 1) { m = 12; y -= 1; }
                      return { year: y, month: m };
                    })}
                    className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded-xl hover:bg-surface-container-highest/20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-black uppercase tracking-tighter text-white">
                    {new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(prev => {
                      let m = prev.month + 1, y = prev.year;
                      if (m > 12) { m = 1; y += 1; }
                      return { year: y, month: m };
                    })}
                    className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded-xl hover:bg-surface-container-highest/20"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-[8px] font-black uppercase text-on-surface-variant/40 py-1">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
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
                      className={`aspect-square rounded-lg flex items-center justify-center border text-[11px] font-black transition-all ${
                        !cell ? 'opacity-0 pointer-events-none' :
                        cell.status === 'WON' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' :
                        cell.status === 'LOST' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20' :
                        cell.status === 'PENDING' ? 'bg-amber-500/5 border-amber-500/20 text-amber-400 animate-pulse' :
                        'bg-surface-container/20 border-outline-variant/10 text-on-surface-variant/30 hover:border-primary/40 hover:text-on-surface-variant'
                      }`}
                    >
                      {cell?.day}
                    </button>
                  ))}
                </div>

                {/* Month quick stats (compact) */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-outline-variant/10">
                  {(() => {
                    const prefix = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}`;
                    const mt = allTickets.filter(t => t.date.startsWith(prefix) && t.matches_count > 0);
                    const mw = mt.filter(t => t.status === 'WON').length;
                    const ml = mt.filter(t => t.status === 'LOST').length;
                    const rate = mw + ml > 0 ? Math.round((mw / (mw + ml)) * 100) : 0;
                    return (
                      <>
                        <div className="flex-1 text-center">
                          <span className="text-[8px] font-black uppercase text-on-surface-variant/50 block">Greens</span>
                          <span className="text-sm font-black text-emerald-400">{mw}</span>
                        </div>
                        <div className="flex-1 text-center">
                          <span className="text-[8px] font-black uppercase text-on-surface-variant/50 block">Reds</span>
                          <span className="text-sm font-black text-rose-400">{ml}</span>
                        </div>
                        <div className="flex-1 text-center">
                          <span className="text-[8px] font-black uppercase text-on-surface-variant/50 block">Acerto</span>
                          <span className="text-sm font-black text-white">{rate}%</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* ── Top-right: Filtros + Stats ───────────────────────────── */}
              <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-5 space-y-5">
                {/* Date range filter */}
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">Filtro de data (range)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={e => setRangeStart(e.target.value)}
                      className="flex-1 bg-black/40 border border-outline-variant/20 rounded-xl px-3 py-2 text-white text-[11px] font-bold focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                    />
                    <span className="text-on-surface-variant/40 text-xs font-black">→</span>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={e => setRangeEnd(e.target.value)}
                      className="flex-1 bg-black/40 border border-outline-variant/20 rounded-xl px-3 py-2 text-white text-[11px] font-bold focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                    />
                    {(rangeStart || rangeEnd) && (
                      <button
                        onClick={() => { setRangeStart(''); setRangeEnd(''); }}
                        className="text-[8px] font-black uppercase tracking-wide text-on-surface-variant hover:text-primary transition-colors whitespace-nowrap px-2 py-2 rounded-lg hover:bg-surface-container-highest/20"
                      >
                        Mês atual
                      </button>
                    )}
                  </div>
                </div>

                {/* Stake */}
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-2 block">Stake</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-on-surface-variant">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={stake}
                      onChange={e => setStake(e.target.value)}
                      placeholder="Ex: 100"
                      className="flex-1 bg-black/40 border border-outline-variant/20 rounded-xl px-4 py-2.5 text-white text-sm font-bold focus:outline-none focus:border-primary/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* 4 stat cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Qtde Green', val: rangeStats.won, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
                    { label: 'Qtde de Loss', val: rangeStats.lost, color: 'text-rose-400', bg: 'bg-rose-500/5 border-rose-500/20' },
                    { label: 'Max Greens Seguidos', val: rangeStats.maxGreen, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/20' },
                    { label: 'Max Loss Seguidos', val: rangeStats.maxLoss, color: 'text-rose-400', bg: 'bg-rose-500/5 border-rose-500/20' },
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} border rounded-xl p-3 text-center`}>
                      <span className="text-[8px] font-black uppercase tracking-wide text-on-surface-variant/60 block mb-1 leading-tight">{s.label}</span>
                      <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Bottom-left: Simulador ───────────────────────────────── */}
              <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-5">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                  <span>💰</span> Simulador de Stake
                </h3>

                {!stake || parseFloat(stake) <= 0 ? (
                  <div className="flex items-center justify-center h-32 text-on-surface-variant/30 text-[10px] font-black uppercase tracking-widest text-center leading-loose">
                    Configure o stake<br />para simular
                  </div>
                ) : rangeStats.won + rangeStats.lost === 0 ? (
                  <div className="flex items-center justify-center h-32 text-on-surface-variant/30 text-[10px] font-black uppercase tracking-widest text-center leading-loose">
                    Sem entradas<br />no período
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant font-bold">Entradas:</span>
                      <span className="text-white font-black">{rangeStats.won + rangeStats.lost}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant font-bold">Total investido:</span>
                      <span className="text-white font-black">R$ {rangeStats.totalInvested.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-400 font-bold">Greens (Lucro):</span>
                      <span className="text-emerald-400 font-black">+ R$ {rangeStats.netGreens.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-rose-400 font-bold">Reds (Loss):</span>
                      <span className="text-rose-400 font-black">- R$ {rangeStats.redLoss.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-outline-variant/15 pt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-black text-white">Resultado:</span>
                        <span className={`text-lg font-black ${rangeStats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {rangeStats.profit >= 0 ? '+' : ''}R$ {rangeStats.profit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-on-surface-variant uppercase">ROI</span>
                        <span className={`text-xs font-black ${rangeStats.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {rangeStats.roi >= 0 ? '+' : ''}{rangeStats.roi.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Bottom-right: Gráfico de evolução do saldo ──────────── */}
              <div className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-5">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> Evolução do saldo
                  {!rangeStart && !rangeEnd && (
                    <span className="text-[8px] font-bold text-on-surface-variant/40 normal-case tracking-normal ml-auto">mês atual</span>
                  )}
                </h3>

                {!stake || parseFloat(stake) <= 0 ? (
                  <div className="flex items-center justify-center h-40 text-on-surface-variant/30 text-[10px] font-black uppercase tracking-widest text-center leading-loose">
                    Configure o stake<br />para ver o gráfico
                  </div>
                ) : (
                  <BalanceChart data={balanceData} />
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Match History Drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedEntry && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
              onClick={() => setSelectedEntry(null)}
            />
            <motion.div
              key="drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d11] border-t border-outline-variant/20 rounded-t-3xl max-h-[82vh] overflow-y-auto shadow-2xl"
            >
              <div className="p-5 space-y-5">
                {/* Handle */}
                <div className="w-10 h-1 bg-outline-variant/30 rounded-full mx-auto" />

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={selectedEntry.homeLogo} className="w-7 h-7 object-contain shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate">
                        {selectedEntry.home} <span className="text-on-surface-variant/50">vs</span> {selectedEntry.away}
                      </p>
                      <p className="text-[9px] text-on-surface-variant font-bold flex items-center gap-1">
                        <BarChart2 className="w-3 h-3" />
                        Dados históricos usados no palpite ·{' '}
                        {new Date(selectedEntry.date_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </p>
                    </div>
                    <img src={selectedEntry.awayLogo} className="w-7 h-7 object-contain shrink-0" />
                  </div>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="p-2 rounded-xl hover:bg-surface-container-highest/20 text-on-surface-variant shrink-0 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Picks history */}
                {entryHistLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedEntry.picks.map((pick: any, i: number) => {
                      const history =
                        pick.teamTarget === 'AWAY' ? entryAwayHistory :
                        pick.teamTarget === 'TOTAL' ? [...entryHomeHistory, ...entryAwayHistory].sort((a, b) => b.match_date.localeCompare(a.match_date)) :
                        entryHomeHistory;

                      const games = history.slice(0, 15);
                      const values = games.map((g: any) => getHistStatValue(g, pick));
                      const met = values.map((v: number | null) =>
                        v !== null ? (pick.type === 'OVER' ? v > pick.threshold : v < pick.threshold) : null
                      );
                      const totalValid = met.filter((m: boolean | null) => m !== null).length;
                      const hitCount = met.filter((m: boolean | null) => m === true).length;
                      const pct = totalValid > 0 ? Math.round((hitCount / totalValid) * 100) : pick.probability;

                      const pickResult = pick.result;

                      return (
                        <div key={i} className={`rounded-2xl p-4 border ${
                          pickResult === 'WON' ? 'bg-emerald-500/5 border-emerald-500/20' :
                          pickResult === 'LOST' ? 'bg-rose-500/5 border-rose-500/20' :
                          'bg-surface/40 border-outline-variant/20'
                        }`}>
                          {/* Pick label row */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="min-w-0">
                              <span className="text-[8px] font-black uppercase tracking-widest text-primary block">
                                {pick.period} · {pick.stat} · {pick.teamTarget === 'HOME' ? selectedEntry.home : pick.teamTarget === 'AWAY' ? selectedEntry.away : 'Total'}
                              </span>
                              <p className="text-xs font-black text-white">{pick.line}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {pickResult && (
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${
                                  pickResult === 'WON' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                }`}>
                                  {pickResult === 'WON' ? '✓ GREEN' : '✗ RED'}
                                </span>
                              )}
                              <div className="text-right">
                                <span className="text-base font-black text-emerald-400 block leading-none">{pct}%</span>
                                <span className="text-[8px] text-on-surface-variant font-bold">{hitCount}/{totalValid} jogos</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-1 bg-black/40 rounded-full mb-3 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {/* Game dots — last 15 games, oldest→newest (right = most recent) */}
                          {games.length === 0 ? (
                            <p className="text-[9px] text-on-surface-variant/40 font-bold text-center py-2">
                              Sem histórico disponível
                            </p>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {[...games].reverse().map((g: any, j: number) => {
                                const idx = games.length - 1 - j;
                                const val = values[idx];
                                const ok = met[idx];
                                return (
                                  <div key={j} className="flex flex-col items-center gap-0.5">
                                    <div className={`w-8 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border ${
                                      ok === null ? 'bg-surface-container/30 border-outline-variant/10 text-on-surface-variant/30' :
                                      ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                                      'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                    }`}>
                                      {val ?? '–'}
                                    </div>
                                    <span className="text-[7px] text-on-surface-variant/30 font-bold">
                                      {new Date(g.match_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
