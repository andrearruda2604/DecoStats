/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, CheckCircle2, TrendingUp, AlertCircle, Share2, ClipboardCopy, ChevronLeft, ChevronRight, Calendar, Clock, Target, Info } from 'lucide-react';
import { motion } from 'motion/react';

export default function Odd20() {
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
      
      // Load current ticket
      const { data, error } = await supabase
        .from('odd_tickets')
        .select('*')
        .eq('date', targetDateStr)
        .maybeSingle();
      
      setTicket(!error && data ? data : null);

      // Load all month tickets for calendar
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

  // Calendar Helper
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
  };

  return (
    <div className="pt-16 px-4 md:px-6 pb-24 max-w-5xl mx-auto">
      
      {/* Navegação de Datas */}
      <div className="flex justify-between items-center mb-6 bg-surface border border-outline-variant/30 rounded-2xl p-2 shadow-sm backdrop-blur-sm max-w-lg mx-auto">
        <button onClick={() => setDateOffset(prev => prev - 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container rounded-xl">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
           <Calendar className="w-4 h-4 text-primary" />
           <span className="text-sm font-bold tracking-wide uppercase">
              {dateOffset === 0 ? 'Hoje' : targetDateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
           </span>
        </div>
        <button onClick={() => setDateOffset(prev => prev + 1)} className="p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container rounded-xl">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : !ticket || ticket.matches_count === 0 ? (
        <div className="text-center p-12 bg-surface border border-outline-variant rounded-3xl mt-8 max-w-lg mx-auto shadow-sm">
            <Info className="w-12 h-12 text-on-surface-variant/20 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-on-surface mb-2">Sem sinais para este dia</h2>
            <p className="text-on-surface-variant text-sm">
              Neste dia específico as métricas de reincidência não atingiram os <strong className="text-primary">80%</strong> exigidos pelo robô.
            </p>
        </div>
      ) : (
        <>
          {/* HEADER TICKET */}
          <div className="text-center mb-10">
             <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${
                ticket.status === 'WON' ? 'bg-emerald-500 shadow-emerald-500/30' :
                ticket.status === 'LOST' ? 'bg-rose-500 shadow-rose-500/30' :
                'bg-primary shadow-primary/30'
             }`}>
                <Trophy className="w-8 h-8 text-white" />
             </motion.div>
             <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2 uppercase">
                {ticket.status === 'WON' ? 'GREEN! Múltipla Batida' : ticket.status === 'LOST' ? 'Red na Múltipla' : 'Bilhete do Dia'}
             </h1>
             <div className="inline-flex mt-3 bg-surface border border-outline-variant rounded-full px-4 py-1.5 items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ticket.status === 'PENDING' ? 'bg-amber-400 animate-pulse' : 'bg-on-surface-variant'}`}></div>
                <span className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Confiança: {ticket.ticket_data.confidence_score}%</span>
             </div>
          </div>

          {/* TICKETS LIST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
             {ticket.ticket_data.entries.map((match: any, i: number) => (
                 <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={match.fixture_id} className="bg-surface/40 border border-outline-variant/30 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden group hover:border-primary/30 transition-all">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${match.result === 'WON' ? 'bg-emerald-500' : match.result === 'LOST' ? 'bg-rose-500' : 'bg-primary'}`}></div>
                    <div className="flex justify-between items-center mb-4">
                       <span className="text-[10px] font-black text-on-surface-variant bg-surface-container px-2 py-1 rounded uppercase">
                          {new Date(match.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                       </span>
                       {match.result && (
                           <span className={`text-[10px] font-black px-2 py-1 rounded ${match.result === 'WON' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                             {match.result}
                           </span>
                       )}
                    </div>
                    <div className="flex items-center justify-between gap-4 mb-5 text-base font-black text-white">
                       <span>{match.home}</span>
                       <span className="text-[10px] text-on-surface-variant/30">X</span>
                       <span>{match.away}</span>
                    </div>
                    <div className="space-y-2">
                       {match.picks.map((pick: any, j: number) => (
                          <div key={j} className="flex justify-between items-center bg-black/30 rounded-xl p-3 border border-white/5">
                             <div className="flex flex-col">
                                <span className={`text-[13px] font-black ${pick.result === 'LOST' ? 'text-rose-400' : pick.result === 'WON' ? 'text-emerald-400' : 'text-on-surface'}`}>
                                   {pick.team}: {pick.line} {pick.stat}
                                </span>
                                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wide">{pick.period} • @ {pick.odd?.toFixed(2)}</span>
                             </div>
                             {pick.actualValue !== undefined && (
                                <div className={`text-[10px] font-black px-2 py-1 rounded bg-black/40 ${pick.result === 'WON' ? 'text-emerald-400' : 'text-rose-400'}`}>FEZ: {pick.actualValue}</div>
                             )}
                          </div>
                       ))}
                    </div>
                 </motion.div>
             ))}
          </div>

          <div className="bg-surface border border-primary/20 p-6 rounded-3xl shadow-2xl mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
             <div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-1">Cotação Total</p>
                <p className="text-4xl font-black text-white tracking-tight">ODD {ticket.total_odd}</p>
             </div>
             <div className="flex gap-3 w-full md:w-auto">
                <button className="flex-1 md:flex-none p-4 bg-surface-variant rounded-2xl text-on-surface-variant hover:text-primary transition-colors"><ClipboardCopy /></button>
                <button className="flex-[2] md:flex-none bg-primary hover:bg-primary-dark text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-widest text-xs">Copiar Bilhete</button>
             </div>
          </div>
        </>
      )}

      {/* HISTÓRICO VISUAL (CALENDÁRIO) */}
      <div className="mt-16 border-t border-outline-variant pt-12">
          <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-on-surface">Histórico Mensal</h2>
                    <p className="text-xs text-on-surface-variant font-bold">Acompanhe nossa performance diária</p>
                 </div>
              </div>
              <div className="hidden md:flex gap-4">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500"></div>
                    <span className="text-[10px] font-black uppercase text-on-surface-variant">Green ({stats.won})</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-rose-500"></div>
                    <span className="text-[10px] font-black uppercase text-on-surface-variant">Red ({stats.lost})</span>
                 </div>
              </div>
          </div>

          <div className="grid grid-cols-7 gap-2 md:gap-4 mb-8">
             {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="text-center text-[10px] font-black uppercase text-on-surface-variant/40 pb-2">{d}</div>
             ))}
             {calendarCells.map((cell, i) => (
                <button
                  key={i}
                  disabled={!cell}
                  onClick={() => cell && handleDayClick(cell.dateStr)}
                  className={`aspect-square rounded-xl md:rounded-2xl flex flex-col items-center justify-center border transition-all ${
                    !cell ? 'opacity-0 pointer-events-none' :
                    cell.status === 'WON' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20' :
                    cell.status === 'LOST' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20' :
                    cell.status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 animate-pulse' :
                    'bg-surface border-outline-variant/30 text-on-surface-variant/40 hover:border-primary/50'
                  } ${cell?.dateStr === targetDateObj.toISOString().split('T')[0] ? 'ring-2 ring-primary ring-offset-4 ring-offset-background scale-105' : ''}`}
                >
                  {cell && (
                    <>
                      <span className="text-sm md:text-lg font-black">{cell.day}</span>
                      {cell.status !== 'EMPTY' && <div className={`w-1 h-1 rounded-full mt-1 ${cell.status === 'WON' ? 'bg-emerald-400' : cell.status === 'LOST' ? 'bg-rose-400' : 'bg-amber-400'}`}></div>}
                    </>
                  )}
                </button>
             ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant flex flex-col items-center">
                <Target className="w-5 h-5 text-primary mb-2 opacity-50" />
                <span className="text-[10px] font-black uppercase text-on-surface-variant">Lucro Médio</span>
                <p className="text-2xl font-black text-white">Odd {stats.avgOdd}</p>
             </div>
             <div className="bg-surface-container p-5 rounded-2xl border border-outline-variant flex flex-col items-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2 opacity-50" />
                <span className="text-[10px] font-black uppercase text-on-surface-variant">Assertividade</span>
                <p className="text-2xl font-black text-white">{Math.round((stats.won / (stats.won + stats.lost || 1)) * 100)}%</p>
             </div>
          </div>
      </div>
    </div>
  );
}
