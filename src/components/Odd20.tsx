/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, CheckCircle2, TrendingUp, AlertCircle, ChevronLeft, ChevronRight, Calendar, Info, History, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Odd20() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [dateOffset, setDateOffset] = useState(0);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ won: 0, lost: 0, pending: 0, avgOdd: '0.00' });

  async function loadCurrentTicket(offset: number) {
    const target = new Date();
    target.setDate(target.getDate() + offset);
    
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const d = String(target.getDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;

    const { data } = await supabase
      .from('odd_tickets')
      .select('*')
      .eq('date', targetDateStr)
      .maybeSingle();

    setTicket(data);
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
      const { data } = await supabase
        .from('odd_tickets')
        .select('*')
        .order('date', { ascending: false });

      if (data) {
        setAllTickets(data);
        const won = data.filter(t => t.status === 'WON').length;
        const lost = data.filter(t => t.status === 'LOST').length;
        const pending = data.filter(t => t.status === 'PENDING').length;
        const odds = data.filter(t => t.status === 'WON').map(t => parseFloat(t.total_odd));
        const avg = odds.length > 0 ? (odds.reduce((a,b) => a+b, 0) / odds.length).toFixed(2) : '0.00';
        setStats({ won, lost, pending, avgOdd: avg });
      }
    }
    loadHistory();

    // REAL-TIME: Ouvir atualizações de bilhetes (Custo zero/baixo)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'odd_tickets' },
        (payload) => {
          console.log('Real-time Update:', payload);
          // Se o bilhete atualizado for o que estamos vendo hoje, atualizamos a UI
          setTicket((current: any) => {
             if (current && payload.new.date === current.date) {
               return payload.new;
             }
             return current;
          });
          // Também atualizamos a lista de histórico
          setAllTickets(prev => prev.map(t => t.date === payload.new.date ? payload.new : t));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  const handleDayClick = (dateStr: string) => {
    const targetDate = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    setDateOffset(diffDays);
    setActiveTab('today');
  };

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);
  const calendarCells = getCalendarData();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 min-h-screen">
      
      {/* HEADER TABS */}
      <div className="flex bg-surface-container/30 backdrop-blur-xl border border-outline-variant/10 rounded-2xl p-1.5 mb-12 max-w-sm mx-auto shadow-2xl relative z-50">
         <button 
           onClick={() => setActiveTab('today')}
           className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'today' ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'text-on-surface-variant hover:text-white'}`}
         >
            <Trophy className="w-4 h-4" />
            Sugestão
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'history' ? 'bg-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]' : 'text-on-surface-variant hover:text-white'}`}
         >
            <History className="w-4 h-4" />
            Histórico
         </button>
      </div>

      <AnimatePresence mode="wait">
         {activeTab === 'today' ? (
            <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               <div className="flex justify-between items-center bg-surface-container/20 border border-outline-variant/10 rounded-2xl p-1.5 max-w-[280px] mx-auto mb-8">
                  <button onClick={() => setDateOffset(prev => prev - 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <div className="flex items-center gap-2 px-4">
                     <span className="text-[11px] font-black uppercase tracking-tighter text-white">
                        {dateOffset === 0 ? 'Hoje' : targetDateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                     </span>
                  </div>
                  <button onClick={() => setDateOffset(prev => prev + 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors"><ChevronRight className="w-4 h-4" /></button>
               </div>

               {loading ? (
                  <div className="flex items-center justify-center min-h-[30vh]"><div className="w-6 h-6 border-2 border-primary border-t-transparent animate-spin rounded-full"></div></div>
               ) : !ticket || ticket.matches_count === 0 ? (
                  <div className="text-center p-16 bg-surface border border-outline-variant/30 rounded-3xl max-w-lg mx-auto">
                      <Info className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
                      <h2 className="text-lg font-black text-on-surface mb-2">Sem sinais para este dia</h2>
                      <p className="text-on-surface-variant text-xs leading-relaxed">As métricas de reincidência não atingiram a meta de 75% exigida pelo robô DecoStats.</p>
                  </div>
               ) : (
                  <>
                     <div className="text-center mb-12">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl ${ticket.status === 'WON' ? 'bg-emerald-500' : ticket.status === 'LOST' ? 'bg-rose-500' : 'bg-primary'}`}>
                           <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2 uppercase">
                           ODD {ticket.total_odd}
                        </h1>
                        <div className="inline-flex bg-surface-container/60 border border-outline-variant/20 rounded-full px-4 py-1.5 items-center gap-2">
                           <div className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'PENDING' ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`}></div>
                           <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">Confiança IA: {ticket.ticket_data.confidence_score}%</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {ticket.ticket_data.entries.map((match: any, i: number) => (
                           <div key={i} className="bg-surface/40 border border-outline-variant/20 rounded-2xl p-6 relative overflow-hidden group transition-all shadow-sm">
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${match.result === 'WON' ? 'bg-emerald-500' : match.result === 'LOST' ? 'bg-rose-500' : 'bg-primary'}`}></div>
                              <div className="flex justify-between items-center mb-6">
                                 <span className="text-[9px] font-black text-on-surface-variant bg-black/40 px-2.5 py-1 rounded-md uppercase tracking-tighter">
                                    {new Date(match.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                 </span>
                                 {match.result && (
                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-md ${match.result === 'WON' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                       {match.result}
                                    </span>
                                 )}
                              </div>
                              <div className="flex items-center justify-between gap-4 mb-8">
                                 <div className="flex flex-col items-center gap-2 flex-1">
                                    <img src={match.homeLogo} alt="" className="w-8 h-8 object-contain drop-shadow-lg" />
                                    <span className="text-[11px] font-black text-white text-center line-clamp-1">{match.home}</span>
                                 </div>
                                 <span className="text-[9px] font-black text-on-surface-variant/20 italic">VS</span>
                                 <div className="flex flex-col items-center gap-2 flex-1">
                                    <img src={match.awayLogo} alt="" className="w-8 h-8 object-contain drop-shadow-lg" />
                                    <span className="text-[11px] font-black text-white text-center line-clamp-1">{match.away}</span>
                                 </div>
                              </div>
                              <div className="space-y-2.5">
                                 {match.picks.map((pick: any, j: number) => (
                                    <div key={j} className="bg-black/30 rounded-xl p-3.5 border border-white/5 group-hover:border-primary/20 transition-colors">
                                       <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-black text-primary uppercase tracking-widest">{pick.period}</span>
                                          <span className="text-[10px] font-black text-amber-500 tabular-nums">{pick.probability}%</span>
                                       </div>
                                       <div className="flex justify-between items-end">
                                          <p className={`text-[12px] font-black leading-tight ${pick.result === 'LOST' ? 'text-rose-400' : pick.result === 'WON' ? 'text-emerald-400' : 'text-on-surface'}`}>
                                             {pick.team}: {pick.line} {pick.stat}
                                          </p>
                                          {pick.actualValue !== undefined && (
                                             <span className={`text-[9px] font-black mb-0.5 ${pick.result === 'WON' ? 'text-emerald-400' : 'text-rose-400'}`}>FEZ: {pick.actualValue}</span>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        ))}
                     </div>
                  </>
               )}
            </motion.div>
         ) : (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-12">
               <div className="text-center md:text-left">
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-1">Histórico</h2>
                  <p className="text-xs text-on-surface-variant font-bold">Consistência diária do Robô DecoStats</p>
               </div>
               <div className="grid grid-cols-7 gap-2 md:gap-4 mb-10">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                     <div key={d} className="text-center text-[9px] font-black uppercase text-on-surface-variant/40 pb-2">{d}</div>
                  ))}
                  {calendarCells.map((cell, i) => (
                     <button
                        key={i}
                        disabled={!cell}
                        onClick={() => cell && handleDayClick(cell.dateStr)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all ${
                        !cell ? 'opacity-0 pointer-events-none' :
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
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                     { label: 'Greens', val: stats.won, color: 'text-emerald-400' },
                     { label: 'Reds', val: stats.lost, color: 'text-rose-400' },
                     { label: 'Taxa Acerto', val: `${Math.round((stats.won / (stats.won + stats.lost || 1)) * 100)}%`, color: 'text-white' },
                     { label: 'Avg Odd', val: stats.avgOdd, color: 'text-primary' }
                  ].map((s, i) => (
                     <div key={i} className="bg-surface/50 p-5 rounded-2xl border border-outline-variant/20 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">{s.label}</span>
                        <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                     </div>
                  ))}
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}
