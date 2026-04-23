/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, CheckCircle2, TrendingUp, AlertCircle, Share2, ClipboardCopy } from 'lucide-react';
import { motion } from 'motion/react';

export default function Odd20() {
  const [dateOffset, setDateOffset] = useState(0);

  useEffect(() => {
    async function loadTicket() {
      setLoading(true);
      const target = new Date();
      target.setDate(target.getDate() + dateOffset);
      const targetDateStr = target.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('odd_tickets')
        .select('*')
        .eq('date', targetDateStr)
        .maybeSingle();
      
      if (!error && data) {
        setTicket(data);
      } else {
        setTicket(null);
      }
      setLoading(false);
    }
    loadTicket();
  }, [dateOffset]);

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + dateOffset);
  const isToday = dateOffset === 0;

  return (
    <div className="pt-16 px-4 md:px-6 pb-24 max-w-lg mx-auto">
      
      {/* Navegação de Datas */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-surface-container-highest p-1 rounded-full">
           <button 
             onClick={() => setDateOffset(-1)}
             className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${dateOffset === -1 ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
           >
             Ontem
           </button>
           <button 
             onClick={() => setDateOffset(0)}
             className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${dateOffset === 0 ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
           >
             Hoje
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      ) : !ticket || ticket.matches_count === 0 ? (
        <div className="text-center p-8 bg-surface border border-outline-variant rounded-3xl mt-8">
            <AlertCircle className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
            <h2 className="text-xl font-bold text-on-surface mb-2">Sem Bilhete para {isToday ? 'Hoje' : 'Ontem'}</h2>
            <p className="text-on-surface-variant text-sm">
              Não encontramos métricas de alta confiança suficientes nos jogos disponíveis.
            </p>
        </div>
      ) : (
        <>
          {/* HEADER TICKET */}
          <div className="text-center mb-8">
             <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg ${
                ticket.status === 'GREEN' ? 'bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/30' :
                ticket.status === 'RED' ? 'bg-gradient-to-br from-rose-400 to-red-600 shadow-rose-500/30' :
                'bg-gradient-to-br from-primary to-blue-600 shadow-cyan-500/30'
             }`}>
                <Trophy className="w-8 h-8 text-white" />
             </div>
             
             <h1 className="text-3xl font-black italic tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
                {ticket.status === 'GREEN' ? 'GREEN NA MÚLTIPLA!' : ticket.status === 'RED' ? 'MÚLTIPLA RED' : 'ODD 2.0 DO DIA'}
             </h1>
             
             <p className="text-on-surface-variant text-sm font-medium">
                {ticket.status === 'PENDING' 
                  ? `Múltipla com ${ticket.matches_count} jogos baseada em estatísticas de alta confiança.` 
                  : `Bilhete retroativo de ${ticket.matches_count} jogos.`}
             </p>

             <div className="inline-flex mt-3 bg-surface border border-outline-variant rounded-full px-3 py-1 items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span className="text-xs font-bold text-on-surface-variant">Confiança da IA: {ticket.ticket_data.confidence_score}%</span>
             </div>
          </div>

          {/* TICKETS LIST */}
          <div className="space-y-4 mb-8">
             {ticket.ticket_data.entries.map((match: any, i: number) => (
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}
                   key={match.fixture_id} 
                   className="bg-surface/50 border border-outline-variant/30 rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden"
                 >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                       match.matchResult === 'GREEN' ? 'bg-emerald-500' : 
                       match.matchResult === 'RED' ? 'bg-rose-500' : 
                       'bg-gradient-to-b from-primary to-blue-500'
                    }`}></div>
                    
                    <div className="flex justify-between items-center mb-3">
                       <div className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded-md">
                           {new Date(match.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                       </div>
                       {match.matchResult ? (
                           <div className={`text-xs font-black px-2 py-1 rounded-md ${match.matchResult === 'GREEN' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                              {match.matchResult === 'GREEN' ? 'BATEU' : 'FALHOU'}
                           </div>
                       ) : (
                           <div className="text-xs font-semibold text-primary flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md">
                              <CheckCircle2 className="w-3 h-3" />
                              Análise Concluída
                           </div>
                       )}
                    </div>

                    <div className="font-bold text-on-surface mb-4">
                       {match.home} <span className="text-on-surface-variant px-1 font-normal">vs</span> {match.away}
                    </div>

                    <div className="space-y-2">
                       {match.picks.map((pick: any, j: number) => (
                          <div key={j} className="flex justify-between items-center bg-background/50 rounded-lg p-3">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{pick.stat}</span>
                                <span className="text-sm font-bold text-on-surface mt-0.5">
                                   {pick.teamTarget === 'HOME' ? match.home : match.away} • <span className={pick.result === 'RED' ? 'text-rose-400' : pick.result === 'GREEN' ? 'text-emerald-400' : 'text-primary'}>{pick.line}</span>
                                </span>
                             </div>
                             <div className="text-right">
                                <div className="text-[10px] font-black text-amber-500 mb-0.5">{pick.probability}% Histórico</div>
                                {pick.actualValue !== undefined ? (
                                   <div className={`text-[10px] font-bold ${pick.result === 'GREEN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      Fez: {pick.actualValue}
                                   </div>
                                ) : (
                                   <div className="text-xs font-black text-on-surface-variant bg-surface px-2 py-0.5 rounded inline-block">
                                      Odd 1.15
                                   </div>
                                )}
                             </div>
                          </div>
                       ))}
                    </div>
                 </motion.div>
             ))}
          </div>

          {/* SUMMARY */}
          <div className={`border p-6 rounded-3xl shadow-xl relative overflow-hidden ${
             ticket.status === 'GREEN' ? 'bg-gradient-to-br from-surface to-emerald-900/20 border-emerald-500/30 shadow-emerald-500/10' :
             ticket.status === 'RED' ? 'bg-gradient-to-br from-surface to-rose-900/20 border-rose-500/30' :
             'bg-gradient-to-br from-surface to-surface-container border-primary/30 shadow-primary/10'
          }`}>
             <div className={`absolute right-0 top-0 w-32 h-32 blur-[50px] rounded-full pointer-events-none ${
                ticket.status === 'GREEN' ? 'bg-emerald-500/20' : ticket.status === 'RED' ? 'bg-rose-500/20' : 'bg-primary/20'
             }`}></div>
             
             <div className="flex justify-between items-end mb-6 relative z-10">
                <div>
                   <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Múltipla Sugerida</p>
                   <div className="flex items-center gap-2">
                      <TrendingUp className={`w-6 h-6 ${ticket.status === 'GREEN' ? 'text-emerald-400' : ticket.status === 'RED' ? 'text-rose-400' : 'text-primary'}`} />
                      <span className="text-4xl font-black text-white">ODD {total_odd}</span>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 relative z-10">
                <button className="flex items-center justify-center gap-2 bg-surface hover:bg-surface-variant border border-outline-variant text-on-surface font-bold py-4 rounded-2xl transition-colors">
                   <ClipboardCopy className="w-5 h-5 pointer-events-none" />
                   Copiar
                </button>
                <button className={`flex items-center justify-center gap-2 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95 ${
                   ticket.status === 'GREEN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/50' : 
                   ticket.status === 'RED' ? 'bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80' : 
                   'bg-primary hover:bg-primary/90 shadow-primary/25'
                }`}>
                   <Share2 className="w-5 h-5" />
                   Compartilhar
                </button>
             </div>
          </div>
        </>
      )}
    </div>
  );
}
