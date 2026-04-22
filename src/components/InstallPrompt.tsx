/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
      return;
    }

    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      // Show iOS prompt after a slight delay
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome detection
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
      <div className="bg-surface border border-outline-variant rounded-2xl shadow-2xl p-4 flex items-center gap-4">
        {/* Logo Placeholder */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-xl font-black text-on-primary">D</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-black text-on-surface uppercase tracking-wide">
            DecoStats
          </h3>
          <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
            {isIOS ? (
              <span>Toque em <span className="inline-block mx-1 font-bold">Compartilhar</span> e depois "Adicionar à Tela de Início"</span>
            ) : (
              <span>Instale o aplicativo para uma melhor experiência</span>
            )}
          </p>
        </div>

        {/* Action Button */}
        {!isIOS && (
          <button
            onClick={handleInstallClick}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-on-primary hover:bg-primary/90 transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
        )}

        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-surface border border-outline-variant text-on-surface-variant flex items-center justify-center rounded-full hover:text-on-surface transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
