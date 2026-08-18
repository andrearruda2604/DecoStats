import { useEffect, useState } from 'react';
import { Crown, ChevronLeft, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import type { League } from '../types';

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
  { id: 'goals', label: 'Gols' },
  { id: 'corners', label: 'Escanteios' },
  { id: 'cards', label: 'Cartões' },
  { id: 'shots_target', label: 'Chutes no Gol' },
  { id: 'shots_total', label: 'Chutes Totais' }
];

function todayBrt() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function fmtDisplayDate(d: string) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function TopsTab({ onSelectMatch }: TopsTabProps) {
  const [targetDate, setTargetDate] = useState(todayBrt());
  const [loading, setLoading] = useState(true);
  const [teamsData, setTeamsData] = useState<Record<string, TeamStat[]>>({});
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('odd_tickets')
          .select('ticket_data')
          .eq('date', targetDate)
          .eq('mode', 'tops')
          .single();

        if (error || !data?.ticket_data?.tops) {
          setTeamsData({});
        } else {
          setTeamsData(data.ticket_data.tops);
        }
      } catch (err) {
        console.error("Error fetching tops do dia:", err);
        setTeamsData({});
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [targetDate]);

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
        
        <div className="relative z-10 flex-1">
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent animate-spin rounded-full" />
        </div>
      ) : Object.keys(teamsData).length === 0 ? (
        <div className="text-center py-20 bg-surface border border-outline-variant/10 rounded-3xl">
          <Activity className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-4" />
          <h3 className="text-lg font-black text-on-surface mb-2">Sem dados para este dia</h3>
          <p className="text-sm text-on-surface-variant">Tente outra data ou aguarde o processamento.</p>
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
                      <span className="text-[10px] text-on-surface-variant font-medium">Média Total Jogo</span>
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
