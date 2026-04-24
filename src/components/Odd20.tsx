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

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const target = new Date();
      target.setDate(target.getDate() + dateOffset);
      const targetDateStr = target.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('odd_tickets')
        .select('*')
        .eq('date', targetDateStr)
        .maybeSingle();
      
      setTicket(!error && data ? data : null);

      const { data: tickets } = await supabase
        .from('odd_tickets')
        .select('date, status, total_odd')
        .order('date', { ascending: true });
      
      if (tickets) {
          setAllTickets(tickets);
          const won = tickets.filter(t => t.status === 'WON').length;
          const lost = tickets.filter(t => t.status === 'LOST').length;
          const pending = tickets.filter(t => t.status === 'PENDING').length;
          const totalOdd = tickets.reduce((acc, t) => acc + (parseFloat(t.total_odd as any) || 0), 0);
          setStats({ won, lost, pending, avgOdd: (totalOdd / (tickets.length || 1)).toFixed(2) });
      }

      setLoading(false);
    }
    loadData();
  }, [dateOffset]);

  const getDaysInMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDay, days };
  };

  const { firstDay, days } = getDaysInMonth();
  const calendarCells = Array.from({ length: 35 }, (_, i) => {
    const day = i - firstDay + 1;
    if (day <= 0 || day > days) return null;
    const d = new Date();
    d.setDate(day);
    const dateStr = d.toISOString().split('T')[0];
    const ticketForDay = allTickets.find(t => t.date === dateStr);
    return { day, dateStr, status: ticketForDay?.status || 'EMPTY' };
  });

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);

  const handleDayClick = (dateStr: string) => {
      const target = new Date(dateStr + 'T12:00:00');
      const today = new Date();
      today.setHours(12,0,0,0);
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      setDateOffset(diffDays);
      setActiveTab('today');
  };

  return (
    <div className="pt-16 px-4 md:px-6 pb-24 max-w-5xl mx-auto">
      
      {/* ABAS */}
      <div className="flex bg-surface-container/40 border border-outline-variant/20 rounded-2xl p-1 mb-10 max-w-sm mx-auto backdrop-blur-xl">
         <button 
           onClick={() => setActiveTab('today')}
           className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'today' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-white'}`}
         >
            <Trophy className="w-3.5 h-3.5" />
            Sugestão
         </button>
         <button 
           onClick={() => setActiveTab('history')}
           className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-white'}`}
         >
            <History className="w-3.5 h-3.5" />
            Histórico
         </button>
      </div>

      <AnimatePresence mode="wait">
         {activeTab === 'today' ? (
            <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
               
               {/* NAVEGAÇÃO DATA */}
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
                      <p className="text-on-surface-variant text-xs leading-relaxed">As métricas de reincidência não atingiram a meta de 80% exigida pelo robô DecoStats.</p>
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
