import { SignIn } from '@clerk/clerk-react';
import { motion } from 'motion/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full flex flex-col items-center gap-8 relative z-10"
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/30">
            <span className="text-2xl font-black text-white italic">D</span>
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2">DECOSTATS</h1>
          <p className="text-sm text-on-surface-variant/50 font-medium">Football Intelligence Platform</p>
        </div>

        <SignIn
          appearance={{
            variables: {
              colorBackground: '#111116',
              colorText: '#ffffff',
              colorTextSecondary: 'rgba(255,255,255,0.5)',
              colorPrimary: '#06B6D4',
              colorInputBackground: '#1a1a24',
              colorInputText: '#ffffff',
              colorNeutral: 'rgba(255,255,255,0.1)',
              borderRadius: '0.75rem',
              fontFamily: 'inherit',
              fontSize: '14px',
            },
            elements: {
              card: '!bg-[#111116] !shadow-2xl !border !border-white/10',
              headerTitle: '!text-white !font-black',
              headerSubtitle: '!text-white/50',
              socialButtonsBlockButton: '!border !border-white/15 !text-white !bg-white/5 hover:!bg-white/10',
              socialButtonsBlockButtonText: '!text-white !font-semibold',
              formFieldInput: '!bg-[#1a1a24] !text-white !border-white/15 focus:!border-[#06B6D4]',
              formFieldLabel: '!text-white/70 !text-sm',
              formButtonPrimary: '!bg-[#06B6D4] hover:!bg-[#0891b2] !text-white !font-bold',
              footerActionLink: '!text-[#06B6D4] hover:!text-[#22d3ee]',
              identityPreviewText: '!text-white',
              identityPreviewEditButton: '!text-[#06B6D4]',
              dividerLine: '!bg-white/10',
              dividerText: '!text-white/30',
              otpCodeFieldInput: '!bg-[#1a1a24] !text-white !border-white/15',
            },
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-[8px] uppercase tracking-[0.4em] text-on-surface-variant/15 font-bold">
            DecoStats © 2026 • Football Intelligence
          </p>
          <a href="/privacidade" className="text-[9px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors underline underline-offset-2">
            Política de Privacidade
          </a>
        </div>
      </motion.div>
    </div>
  );
}
