/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Trophy, CheckCircle2, TrendingUp, AlertCircle, Share2, ClipboardCopy } from 'lucide-react';
import { motion } from 'motion/react';

export default function Odd20() {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTicket() {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('odd_tickets')
        .select('*')
        .eq('date', today)
        .maybeSingle();
      
      if (!error && data) {
        setTicket(data);
      }
      setLoading(false);
    }
    loadTicket();
  }, []);

  if (loading) {
     return (
        <div className="pt-16 px-4 md:px-6 flex items-center justify-center min-h-[80vh]">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
     );
  }

  if (!ticket || ticket.matches_count === 0) {
      return (
        <div className="pt-24 px-4 md:px-6 pb-24 max-w-lg mx-auto">
           <div className="text-center p-8 bg-surface border border-outline-variant rounded-3xl">
              <AlertCircle className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
              <h2 className="text-xl font-bold text-on-surface mb-2">Sem Bilhete Diário</h2>
              <p className="text-on-surface-variant text-sm">
                Não encontramos garantias de 100% estatísticas nos jogos listados para hoje. 
                Nossa IA prefere não sugerir aposta do que sugerir uma opção de risco.
              </p>
           </div>
        </div>
      );
  }

  const { ticket_data, total_odd, matches_count } = ticket;
  const entries = ticket_data.entries || [];

  return (
    <div className="pt-16 px-4 md:px-6 pb-24 max-w-lg mx-auto">
      
      {/* HEADER TICKET */}
      <div className="text-center mb-8">
         <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <Trophy className="w-8 h-8 text-on-primary" />
         </div>
         <h1 className="text-3xl font-black italic tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent mb-2">
            ODD 2.0 DO DIA
         </h1>
         <p className="text-on-surface-variant text-sm font-medium">
            Bilhete Seguro ({matches_count} jogos) construído 100% por estatísticas históricas garantidas.
         </p>
      </div>

      {/* TICKETS LIST */}
      <div className="space-y-4 mb-8">
         {entries.map((match: any, i: number) => (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               key={match.fixture_id} 
               className="bg-surface/50 border border-outline-variant/30 rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden"
             >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-emerald-500"></div>
                
                <div className="flex justify-between items-center mb-3">
                   <div className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded-md">
                       {new Date(match.date_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                   </div>
                   <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                      <CheckCircle2 className="w-3 h-3" />
                      100% Win Rate Histórico
                   </div>
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
                               {pick.teamTarget === 'HOME' ? match.home : match.away} • <span className="text-primary">{pick.line}</span>
                            </span>
                         </div>
                         <div className="text-xs font-black text-on-surface-variant bg-surface px-2 py-1 rounded">
                            Odd 1.15
                         </div>
                      </div>
                   ))}
                </div>
             </motion.div>
         ))}
      </div>

      {/* SUMMARY */}
      <div className="bg-gradient-to-br from-surface to-surface-container border border-primary/30 p-6 rounded-3xl shadow-[0_10px_40px_rgba(6,182,212,0.15)] relative overflow-hidden">
         <div className="absolute right-0 top-0 w-32 h-32 bg-primary/20 blur-[50px] rounded-full pointer-events-none"></div>
         
         <div className="flex justify-between items-end mb-6 relative z-10">
            <div>
               <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Múltipla Sugerida</p>
               <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <span className="text-4xl font-black text-white">ODD {total_odd}</span>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4 relative z-10">
            <button className="flex items-center justify-center gap-2 bg-surface hover:bg-surface-variant border border-outline-variant text-on-surface font-bold py-4 rounded-2xl transition-colors">
               <ClipboardCopy className="w-5 h-5 pointer-events-none" />
               Copiar
            </button>
            <button className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-bold py-4 rounded-2xl shadow-lg shadow-primary/25 transition-all active:scale-95">
               <Share2 className="w-5 h-5" />
               Compartilhar
            </button>
         </div>
      </div>

    </div>
  );
}
