/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArrowLeft, LayoutGrid, BarChart2, Activity } from 'lucide-react';
import { ReactNode } from 'react';

export type ViewType = 'LOBBY' | 'DATA';

interface LayoutProps {
  children: ReactNode;
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  showBack?: boolean;
}

export default function Layout({ children, activeView, onNavigate, showBack = false }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary selection:text-on-primary blueprint-grid">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-14 border-b border-outline-variant/10 bg-[#060610]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => onNavigate('LOBBY')}
              className="text-on-surface-variant/60 hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-container-highest/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h1 className="font-headline font-black tracking-tighter uppercase text-on-surface text-base">
              Deco<span className="text-primary">Stats</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NavPill
            label="Jogos"
            active={activeView === 'LOBBY'}
            onClick={() => onNavigate('LOBBY')}
          />
          <NavPill
            label="Análise"
            active={activeView === 'DATA'}
            onClick={() => onNavigate('DATA')}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-8 px-4 md:px-8 max-w-6xl mx-auto min-h-screen">
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
