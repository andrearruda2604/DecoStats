/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowLeft, LayoutGrid, BarChart2, Activity, LogOut } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

export type ViewType = 'LOBBY' | 'DATA' | 'ODD20';

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
    supabase.from('odd_tickets').select('total_odd, status').eq('date', dateStr).maybeSingle().then(({data}) => {
      if (data) setDailyOdd(data.total_odd);
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
           <div className="flex bg-surface-container-highest/50 rounded-full p-1 border border-outline-variant/20 shadow-inner">
             <button 
                onClick={() => onNavigate('LOBBY')}
                className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors ${activeView === 'LOBBY' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
             >
                Jogos
             </button>
             <button 
                onClick={() => onNavigate('ODD20')}
                className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${activeView === 'ODD20' ? 'bg-primary text-on-primary shadow shadow-primary/20' : 'text-primary/70 hover:text-primary'}`}
             >
                Odd 2.0
                {dailyOdd && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${activeView === 'ODD20' ? 'bg-black/20 text-white' : 'bg-primary/20 text-primary'}`}>
                    {dailyOdd}
                  </span>
                )}
             </button>
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
