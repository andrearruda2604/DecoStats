/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, CheckCircle2, TrendingUp, AlertCircle, Share2, ClipboardCopy, ChevronLeft, ChevronRight, Calendar, Clock, Target } from 'lucide-react';
import { motion } from 'motion/react';

export default function Odd20() {
  const [dateOffset, setDateOffset] = useState(0);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

      // Load monthly performance stats
      const { data: allTickets } = await supabase.from('odd_tickets').select('status, total_odd');
      if (allTickets) {
          const won = allTickets.filter(t => t.status === 'WON').length;
          const lost = allTickets.filter(t => t.status === 'LOST').length;
          const pending = allTickets.filter(t => t.status === 'PENDING').length;
          const totalOdd = allTickets.reduce((acc, t) => acc + (parseFloat(t.total_odd as any) || 0), 0);
          setStats({ won, lost, pending, avgOdd: (totalOdd / (allTickets.length || 1)).toFixed(2) });
      }

      setLoading(false);
    }
    loadData();
  }, [dateOffset]);

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);
  const isToday = dateOffset === 0;

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
              {isToday ? 'Hoje' : targetDateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
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
        <div className="text-center p-8 bg-surface border border-outline-variant rounded-3xl mt-8 max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
            <h2 className="text-xl font-bold text-on-surface mb-2">Sem Bilhete de Valor</h2>
            <p className="text-on-surface-variant text-sm text-left">
              Para listar jogos no Bilhete Odd 2.0, monitoramos estritamente taxas de reincidência superiores a <strong className="text-primary">80%</strong>. Neste dia específico as ligas não geraram dados contundentes.
            </p>
        </div>
      ) : (
        <>
          {/* HEADER TICKET */}
          <div className="text-center mb-10">
             <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${
                ticket.status === 'WON' ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/30' :
                ticket.status === 'LOST' ? 'bg-gradient-to-br from-rose-400 to-red-600 shadow-rose-500/30' :
                'bg-gradient-to-br from-primary to-blue-600 shadow-cyan-500/30'
             }`}>
                <Trophy className="w-8 h-8 text-white" />
             </div>
             <h1 className="text-4xl font-black italic tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                {ticket.status === 'WON' ? 'GREEN NA MÚLTIPLA!' : ticket.status === 'LOST' ? 'MÚLTIPLA RED' : 'ODD 2.0 DO DIA'}
             </h1>
             <div className="inline-flex mt-3 bg-surface border border-outline-variant rounded-full px-3 py-1 items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span className="text-xs font-bold text-on-surface-variant">Confiança da IA: {ticket.ticket_data.confidence_score}%</span>
             </div>
          </div>

          {/* TICKETS LIST */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
             {ticket.ticket_data.entries.map((match: any, i: number) => (
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={match.fixture_id} className="bg-surface/50 border border-outline-variant/30 rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${match.result === 'WON' ? 'bg-emerald-500' : match.result === 'LOST' ? 'bg-rose-500' : 'bg-gradient-to-b from-primary to-blue-500'}`}></div>
                    <div className="flex justify-between items-center mb-4">
                       <div className="text-[10px] font-black text-on-surface-variant bg-surface-container px-2 py-1 rounded-md uppercase">
                          {new Date(match.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                       </div>
                       {match.result && (
                           <div className={`text-[10px] font-black px-2 py-1 rounded-md ${match.result === 'WON' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                             {match.result === 'WON' ? 'GREEN' : 'RED'}
                           </div>
                       )}
                    </div>
                    <div className="flex items-center justify-between gap-4 mb-4 text-sm font-bold">
                       <span>{match.home}</span>
                       <span className="text-[10px] text-on-surface-variant/30">VS</span>
                       <span>{match.away}</span>
                    </div>
                    <div className="space-y-2">
                       {match.picks.map((pick: any, j: number) => (
                          <div key={j} className="flex justify-between items-center bg-background/50 rounded-lg p-2.5">
                             <div className="flex flex-col">
                                <span className={`text-sm font-bold ${pick.result === 'LOST' ? 'text-rose-400' : pick.result === 'WON' ? 'text-emerald-400' : 'text-on-surface'}`}>
                                   {pick.team}: {pick.line} {pick.stat}
                                </span>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">{pick.period} • Odd {pick.odd?.toFixed(2)}</span>
                             </div>
                             {pick.actualValue !== undefined && (
                                <div className={`text-[10px] font-bold ${pick.result === 'WON' ? 'text-emerald-400' : 'text-rose-400'}`}>Real: {pick.actualValue}</div>
                             )}
                          </div>
                       ))}
                    </div>
                 </motion.div>
             ))}
          </div>

          {/* SUMMARY BUTTONS */}
          <div className="bg-surface border border-primary/30 p-6 rounded-3xl shadow-xl">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase mb-1">Múltipla Sugerida</p>
                  <p className="text-3xl font-black text-white">ODD {ticket.total_odd}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-4 bg-surface-variant rounded-2xl text-on-surface-variant"><ClipboardCopy /></button>
                  <button className="p-4 bg-primary rounded-2xl text-white font-bold px-8">COPIAR BILHETE</button>
                </div>
             </div>
          </div>
        </>
      )}

      {/* PERFORMANCE SUMMARY */}
      {!loading && (
          <div className="mt-12 border-t border-outline-variant pt-10">
             <div className="flex items-center gap-3 mb-8">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-lg font-black uppercase text-on-surface">Histórico Mensal</h2>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="p-5 rounded-2xl border bg-emerald-500/5 border-emerald-500/20 text-center">
                   <p className="text-[10px] font-black uppercase text-on-surface-variant/60">Greens</p>
                   <p className="text-2xl font-black text-emerald-400">{stats.won}</p>
                </div>
                <div className="p-5 rounded-2xl border bg-rose-500/5 border-rose-500/20 text-center">
                   <p className="text-[10px] font-black uppercase text-on-surface-variant/60">Reds</p>
                   <p className="text-2xl font-black text-rose-400">{stats.lost}</p>
                </div>
                <div className="p-5 rounded-2xl border bg-amber-500/5 border-amber-500/20 text-center">
                   <p className="text-[10px] font-black uppercase text-on-surface-variant/60">Apurando</p>
                   <p className="text-2xl font-black text-amber-400">{stats.pending}</p>
                </div>
                <div className="p-5 rounded-2xl border bg-primary/5 border-primary/20 text-center">
                   <p className="text-[10px] font-black uppercase text-on-surface-variant/60">Média Odd</p>
                   <p className="text-2xl font-black text-primary">{stats.avgOdd}</p>
                </div>
             </div>
          </div>
      )}
    </div>
  );
}
