/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowLeft, LayoutGrid, BarChart2, Activity, LogOut, ExternalLink } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

export type ViewType = 'LOBBY' | 'DATA' | 'ODD20' | 'ODD30';


interface LayoutProps {
  children: ReactNode;
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  showBack?: boolean;
}

import InstallPrompt from './InstallPrompt';

export default function Layout({ children, activeView, onNavigate, showBack = false }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [dailyOdd, setDailyOdd] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    supabase.from('odd_tickets')
      .select('total_odd, mode')
      .eq('date', dateStr)
      .then(({data}) => {
        const ticket20 = data?.find(t => t.mode === '2.0');
        if (ticket20) setDailyOdd(ticket20.total_odd);
      });
  }, []);


  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary pb-16">
      <InstallPrompt />
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-6 h-14 border-b border-outline-variant/30 bg-black/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={() => onNavigate('LOBBY')}
              className="text-on-surface-variant/60 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-container-highest/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-1 cursor-pointer" onClick={() => onNavigate('LOBBY')}>
             <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-black text-on-primary text-xs shadow-lg shadow-primary/20">D</div>
             <h1 className="text-xl font-black italic tracking-tighter hidden sm:block ml-1">
                DECOSTATS
             </h1>
          </div>
        </div>
        
        {!showBack && (
           <div className="flex items-center gap-4">
             {activeView !== 'LOBBY' && (
               <button 
                  onClick={() => onNavigate('LOBBY')}
                  className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
               >
                  Jogos
               </button>
             )}
             <div className="flex items-center gap-1">
               <button
                  onClick={() => onNavigate('ODD20')}
                  className={`relative group pl-3 pr-3 py-2 rounded-l-xl text-[11px] font-black uppercase tracking-widest transition-all overflow-hidden flex items-center gap-2 ${
                    activeView === 'ODD20'
                      ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)] scale-105'
                      : 'bg-amber-400/90 text-black hover:bg-amber-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:scale-105'
                  }`}
               >
                  {/* Badge Bet365 */}
                  <span
                    className="inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-[8px] font-black text-white tracking-tight shrink-0"
                    style={{ background: '#00884c' }}
                  >
                    bet365
                  </span>
                  {dailyOdd ? 'Bilhete' : 'Odd 2.0'}
                  {dailyOdd && (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                      activeView === 'ODD20' ? 'bg-black/20' : 'bg-black/10'
                    }`}>
                      {dailyOdd}
                    </span>
                  )}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
               </button>
               {/* Link direto Bet365 */}
               <a
                 href="https://www.bet365.com.br/#/AC/B1/"
                 target="_blank"
                 rel="noopener noreferrer"
                 onClick={e => e.stopPropagation()}
                 title="Abrir Bet365"
                 className={`py-2 px-2 rounded-r-xl transition-all flex items-center ${
                   activeView === 'ODD20'
                     ? 'bg-amber-400 text-black/60 hover:text-black shadow-[0_0_20px_rgba(251,191,36,0.6)]'
                     : 'bg-amber-400/90 text-black/50 hover:bg-amber-400 hover:text-black'
                 }`}
               >
                 <ExternalLink className="w-3.5 h-3.5" />
               </a>
             </div>
             {user?.email?.toLowerCase() === 'deco260483@gmail.com' && (
               <button 
                 onClick={() => onNavigate('ODD30')}
                 className={`relative group px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all overflow-hidden flex items-center gap-2 ${
                   activeView === 'ODD30' 
                     ? 'bg-primary text-on-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.6)] scale-105' 
                     : 'bg-primary/90 text-on-primary hover:bg-primary hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] hover:scale-105'
                 }`}
               >
                 ODD 3.0 (Test)
                 <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
               </button>
             )}
           </div>
        )}

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-7 h-7 rounded-full border border-outline-variant/30 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary uppercase">
              {displayName.charAt(0)}
            </div>
          )}
          <span className="text-[10px] font-bold text-on-surface-variant/60 hidden sm:block max-w-[100px] truncate">
            {displayName}
          </span>
          <button
            onClick={signOut}
            className="p-1.5 rounded-lg text-on-surface-variant/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>


      {/* Main Content */}
      <main className="pt-20 pb-8 px-3 sm:px-6 xl:px-10 w-full max-w-[1600px] mx-auto min-h-screen">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/10 py-6 px-4 text-center">
        <p className="text-[8px] uppercase font-bold tracking-[0.5em] text-on-surface-variant/15">
          DecoStats © 2026 • Football Intelligence
        </p>
      </footer>
    </div>
  );
}

function NavPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${
        active
          ? 'bg-primary/10 text-primary border border-primary/30'
          : 'text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container-highest/20 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}
