/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, ChevronLeft, ChevronRight, Info, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Odd20() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [dateOffset, setDateOffset] = useState(0);
  const [ticket, setTicket] = useState<any>(null);
  const [liveScores, setLiveScores] = useState<Record<number, any>>({});
  const [liveStats, setLiveStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ won: 0, lost: 0, pending: 0, avgOdd: '0.00' });

  async function loadCurrentTicket(offset: number) {
    const target = new Date();
    target.setDate(target.getDate() + offset);
    
    const targetDateStr = target.toISOString().split('T')[0];

    const { data } = await supabase
      .from('odd_tickets')
      .select('*')
      .eq('date', targetDateStr)
      .maybeSingle();

    if (data) {
       setTicket(data);
       // Carregar placares iniciais dos jogos do bilhete
       const ids = data.ticket_data.entries.map((e: any) => e.fixture_id);
       const { data: fixtures } = await supabase.from('fixtures').select('api_id, goals_home, goals_away, status').in('api_id', ids);
       const scoreMap: Record<number, any> = {};
       fixtures?.forEach(f => scoreMap[f.api_id] = f);
       setLiveScores(scoreMap);

       // Carregar estatísticas iniciais
       const { data: statsData } = await supabase.from('match_stats').select('*').in('fixture_id', ids);
       const statsMap: Record<string, number> = {};
       statsData?.forEach(s => statsMap[`${s.fixture_id}-${s.team_id}-${s.type}`] = parseInt(s.value));
       setLiveStats(statsMap);
    } else {
       setTicket(null);
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await loadCurrentTicket(dateOffset);
      setLoading(false);
    }
    loadData();
  }, [dateOffset]);

  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase.from('odd_tickets').select('*').order('date', { ascending: false });
      if (data) {
        setAllTickets(data);
        const won = data.filter(t => t.status === 'WON').length;
        const lost = data.filter(t => t.status === 'LOST').length;
        const odds = data.filter(t => t.status === 'WON').map(t => parseFloat(t.total_odd));
        const avg = odds.length > 0 ? (odds.reduce((a,b) => a+b, 0) / odds.length).toFixed(2) : '0.00';
        setStats({ won, lost, pending: data.filter(t => t.status === 'PENDING').length, avgOdd: avg });
      }
    }
    loadHistory();

    // REAL-TIME CHANNELS
    const tixChannel = supabase.channel('tix').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'odd_tickets' }, (p) => {
        setTicket((curr: any) => (curr && p.new.date === curr.date) ? p.new : curr);
        setAllTickets(prev => prev.map(t => t.date === p.new.date ? p.new : t));
    }).subscribe();

    const fixChannel = supabase.channel('fix').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fixtures' }, (p) => {
        setLiveScores(prev => ({ ...prev, [p.new.api_id]: p.new }));
    }).subscribe();

    const statsChannel = supabase.channel('stats').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_stats' }, (p: any) => {
        setLiveStats(prev => ({ ...prev, [`${p.new.fixture_id}-${p.new.team_id}-${p.new.type}`]: parseInt(p.new.value) }));
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_stats' }, (p: any) => {
        setLiveStats(prev => ({ ...prev, [`${p.new.fixture_id}-${p.new.team_id}-${p.new.type}`]: parseInt(p.new.value) }));
    }).subscribe();

    return () => {
      supabase.removeChannel(tixChannel);
      supabase.removeChannel(fixChannel);
      supabase.removeChannel(statsChannel);
    };
  }, []);

  const getCalendarData = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const cells = [];
    for (let i = 0; i < start.getDay(); i++) cells.push(null);
    for (let i = 1; i <= end.getDate(); i++) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const t = allTickets.find(x => x.date === dateStr);
      cells.push({ day: i, dateStr, status: t?.status });
    }
    return cells;
  };

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 min-h-screen">
      <div className="flex bg-surface-container/30 backdrop-blur-xl border border-outline-variant/10 rounded-2xl p-1.5 mb-12 max-w-sm mx-auto shadow-2xl relative z-50">
         <button onClick={() => setActiveTab('today')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'today' ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'text-on-surface-variant hover:text-white'}`}><Trophy className="w-4 h-4" />Sugestão</button>
         <button onClick={() => setActiveTab('history')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'history' ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'text-on-surface-variant hover:text-white'}`}><History className="w-4 h-4" />Histórico</button>
      </div>

      <AnimatePresence mode="wait">
         {activeTab === 'today' ? (
            <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               <div className="flex justify-between items-center bg-surface-container/20 border border-outline-variant/10 rounded-2xl p-1.5 max-w-[280px] mx-auto mb-8">
                  <button onClick={() => setDateOffset(prev => prev - 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-[11px] font-black uppercase tracking-tighter text-white">{dateOffset === 0 ? 'Hoje' : targetDateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}</span>
                  <button onClick={() => setDateOffset(prev => prev + 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors"><ChevronRight className="w-4 h-4" /></button>
               </div>

               {loading ? (
                  <div className="flex items-center justify-center min-h-[30vh]"><div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin rounded-full"></div></div>
               ) : !ticket || ticket.matches_count === 0 ? (
                  <div className="text-center p-16 bg-surface border border-outline-variant/30 rounded-3xl max-w-lg mx-auto">
                      <Info className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
                      <h2 className="text-lg font-black text-on-surface mb-2">Sem sinais</h2>
                      <p className="text-on-surface-variant text-xs">As métricas não atingiram a meta de 75%.</p>
                  </div>
               ) : (
                  <>
                     <div className="text-center mb-12">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl ${ticket.status === 'WON' ? 'bg-emerald-500' : ticket.status === 'LOST' ? 'bg-rose-500' : 'bg-primary'}`}><Trophy className="w-6 h-6 text-white" /></div>
                        <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2 uppercase">ODD {ticket.total_odd}</h1>
                        <div className="inline-flex bg-surface-container/60 border border-outline-variant/20 rounded-full px-4 py-1.5 items-center gap-2">
                           <div className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'PENDING' ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`}></div>
                           <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Confiança IA: {ticket.ticket_data.confidence_score}%</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {ticket.ticket_data.entries.map((match: any, i: number) => {
                           const live = liveScores[match.fixture_id];
                           const isLive = live?.status && !['NS', 'TBD', 'FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD'].includes(live.status);
                           const isFinished = live?.status === 'FT';
                           
                           return (
                           <div key={i} className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-6 relative overflow-hidden group transition-all shadow-sm">
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${match.result === 'WON' ? 'bg-emerald-500' : match.result === 'LOST' ? 'bg-rose-500' : 'bg-primary'}`}></div>
                              <div className="flex justify-between items-center mb-6">
                                 <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-on-surface-variant bg-black/40 px-2.5 py-1 rounded-md uppercase tracking-tighter">
                                       {new Date(match.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    {isLive && <span className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/10 rounded-md"><span className="w-1 h-1 bg-rose-500 rounded-full animate-pulse"></span><span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">AO VIVO</span></span>}
                                 </div>
                                 {match.result && <span className={`text-[9px] font-black px-2.5 py-1 rounded-md ${match.result === 'WON' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>{match.result}</span>}
                              </div>
                              <div className="flex items-center justify-between gap-4 mb-8">
                                 <div className="flex flex-col items-center gap-2 flex-1"><img src={match.homeLogo} className="w-8 h-8 object-contain" /><span className="text-[10px] font-black text-white text-center line-clamp-1">{match.home}</span></div>
                                 <div className="flex flex-col items-center">
                                    {(isLive || isFinished) ? (
                                       <span className="text-xl font-black text-white italic tabular-nums tracking-tighter">{live.goals_home} - {live.goals_away}</span>
                                    ) : <span className="text-[9px] font-black text-on-surface-variant/20 italic">VS</span>}
                                    {isLive && live?.status && <span className="text-[8px] font-black text-rose-500 mt-1">{live.status}</span>}
                                 </div>
                                 <div className="flex flex-col items-center gap-2 flex-1"><img src={match.awayLogo} className="w-8 h-8 object-contain" /><span className="text-[10px] font-black text-white text-center line-clamp-1">{match.away}</span></div>
                              </div>
                              <div className="space-y-2.5">
                                 {match.picks.map((pick: any, j: number) => {
                                    const teamId = (pick.teamTarget === 'HOME' ? live?.home_team_id : live?.away_team_id) || (pick.team === match.home ? live?.home_team_id : live?.away_team_id);
                                    // Mapear estatística do banco
                                    const statTypeMap: Record<string, string> = { 'ESCANTEIOS': 'Corner Kicks', 'CARTÃO AMARELO': 'Yellow Cards', 'CHUTES': 'Total Shots' };
                                    const apiStatType = statTypeMap[pick.stat] || pick.stat;
                                    const currentVal = liveStats[`${match.fixture_id}-${teamId}-${apiStatType}`] ?? (pick.stat === 'GOLS MARCADOS' ? (pick.teamTarget === 'HOME' ? live?.goals_home : live?.goals_away) : undefined);

                                    return (
                                    <div key={j} className="bg-black/30 rounded-xl p-3.5 border border-white/5 group-hover:border-primary/20 transition-colors">
                                       <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-black text-primary uppercase tracking-widest">{pick.period}</span>
                                          <span className="text-[10px] font-black text-amber-500 tabular-nums">{pick.probability}%</span>
                                       </div>
                                       <div className="flex justify-between items-end">
                                          <p className={`text-[11px] font-black leading-tight ${pick.result === 'LOST' ? 'text-rose-400' : pick.result === 'WON' ? 'text-emerald-400' : 'text-on-surface'}`}>{pick.team}: {pick.line} {pick.stat}</p>
                                          {currentVal !== undefined && <span className={`text-[9px] font-black mb-0.5 ${pick.result === 'WON' ? 'text-emerald-400' : 'text-rose-400/60'}`}>FEZ: {currentVal}</span>}
                                       </div>
                                    </div>
                                 )})}
                              </div>
                           </div>
                        )})}
                     </div>
                  </>
               )}
            </motion.div>
         ) : (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
               <div className="grid grid-cols-7 gap-2 md:gap-4 mb-10">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <div key={d} className="text-center text-[9px] font-black uppercase text-on-surface-variant/40 pb-2">{d}</div>)}
                  {getCalendarData().map((cell, i) => (
                     <button key={i} disabled={!cell} onClick={() => cell && setDateOffset(Math.round((new Date(cell.dateStr + 'T12:00:00').getTime() - new Date().setHours(12,0,0,0))/(1000*60*60*24))) || setActiveTab('today')}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${!cell?'opacity-0':cell.status==='WON'?'bg-emerald-500/10 border-emerald-500/40 text-emerald-400':cell.status==='LOST'?'bg-rose-500/10 border-rose-500/40 text-rose-400':cell.status==='PENDING'?'bg-amber-500/5 animate-pulse border-amber-500/20':'bg-surface-container/20 border-outline-variant/10 text-on-surface-variant/20 hover:border-primary/40'}`}
                     >{cell && <span className="text-sm font-black">{cell.day}</span>}</button>
                  ))}
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[ { label: 'Greens', val: stats.won, color: 'text-emerald-400' }, { label: 'Reds', val: stats.lost, color: 'text-rose-400' }, { label: 'Taxa Acerto', val: `${Math.round((stats.won / (stats.won + stats.lost || 1)) * 100)}%`, color: 'text-white' }, { label: 'Avg Odd', val: stats.avgOdd, color: 'text-primary' } ].map((s, i) => (
                     <div key={i} className="bg-surface/50 p-5 rounded-2xl border border-outline-variant/20 text-center"><span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">{s.label}</span><p className={`text-2xl font-black ${s.color}`}>{s.val}</p></div>
                  ))}
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}
