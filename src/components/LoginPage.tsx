import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';

type View = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, updatePassword, isRecovery } = useAuth();

  const [view, setView]         = useState<View>(isRecovery ? 'reset' : 'signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  const clearForm = () => { setError(null); setSuccess(null); setPassword(''); setConfirm(''); };

  const go = (v: View) => { setView(v); clearForm(); };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await signInWithEmail(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6)  { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    setLoading(true); setError(null);
    const { error } = await signUpWithEmail(email, password);
    if (error) { setError(error); }
    else { setSuccess('Conta criada! Verifique seu email para confirmar.'); }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await resetPassword(email);
    if (error) { setError(error); }
    else { go('sent'); }
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true); setError(null);
    const { error } = await updatePassword(password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-primary/30">
            <span className="text-xl font-black text-white italic">D</span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white mb-1">DECOSTATS</h1>
          <p className="text-xs text-on-surface-variant/50 font-medium">Football Intelligence Platform</p>
        </div>

        <div className="bg-surface/40 backdrop-blur-xl border border-outline-variant/20 rounded-3xl p-7 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── SIGN IN ── */}
            {view === 'signin' && (
              <motion.div key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="text-base font-black text-white mb-1">Entrar</h2>
                <p className="text-[11px] text-on-surface-variant/50 mb-5">Acesse sua conta DecoStats</p>

                <form onSubmit={handleSignIn} className="space-y-3">
                  <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
                  <PasswordInput label="Senha" value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(p => !p)} />

                  <button type="button" onClick={() => go('forgot')} className="text-[11px] text-primary/70 hover:text-primary transition-colors">
                    Esqueci minha senha
                  </button>

                  {error && <ErrorMsg msg={error} />}
                  {success && <SuccessMsg msg={success} />}

                  <SubmitBtn loading={loading} label="Entrar" />
                </form>

                <Divider />

                <GoogleBtn onClick={signInWithGoogle} />

                <p className="text-center text-[11px] text-on-surface-variant/50 mt-4">
                  Não tem conta?{' '}
                  <button onClick={() => go('signup')} className="text-primary hover:text-primary/80 font-bold transition-colors">
                    Criar conta
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── SIGN UP ── */}
            {view === 'signup' && (
              <motion.div key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button onClick={() => go('signin')} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/50 hover:text-primary transition-colors mb-4">
                  <ArrowLeft className="w-3 h-3" /> Voltar
                </button>
                <h2 className="text-base font-black text-white mb-1">Criar conta</h2>
                <p className="text-[11px] text-on-surface-variant/50 mb-5">Acesso completo às análises</p>

                <form onSubmit={handleSignUp} className="space-y-3">
                  <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
                  <PasswordInput label="Senha" value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(p => !p)} />
                  <PasswordInput label="Confirmar senha" value={confirm} onChange={setConfirm} show={showPass} onToggle={() => setShowPass(p => !p)} />

                  {error && <ErrorMsg msg={error} />}
                  {success && <SuccessMsg msg={success} />}

                  <SubmitBtn loading={loading} label="Criar conta" />
                </form>

                <Divider />
                <GoogleBtn onClick={signInWithGoogle} />
              </motion.div>
            )}

            {/* ── FORGOT PASSWORD ── */}
            {view === 'forgot' && (
              <motion.div key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button onClick={() => go('signin')} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/50 hover:text-primary transition-colors mb-4">
                  <ArrowLeft className="w-3 h-3" /> Voltar
                </button>
                <h2 className="text-base font-black text-white mb-1">Redefinir senha</h2>
                <p className="text-[11px] text-on-surface-variant/50 mb-5">Enviaremos um link para o seu email</p>

                <form onSubmit={handleForgot} className="space-y-3">
                  <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
                  {error && <ErrorMsg msg={error} />}
                  <SubmitBtn loading={loading} label="Enviar link" />
                </form>
              </motion.div>
            )}

            {/* ── EMAIL SENT ── */}
            {view === 'sent' && (
              <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-base font-black text-white mb-2">Verifique seu email</h2>
                <p className="text-[12px] text-on-surface-variant/60 mb-6">
                  Enviamos um link para <span className="text-primary">{email}</span>. Clique nele para redefinir sua senha.
                </p>
                <button onClick={() => go('signin')} className="text-[11px] text-primary hover:text-primary/80 font-bold transition-colors">
                  Voltar ao login
                </button>
              </motion.div>
            )}

            {/* ── RESET PASSWORD (after clicking email link) ── */}
            {view === 'reset' && (
              <motion.div key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h2 className="text-base font-black text-white mb-1">Nova senha</h2>
                <p className="text-[11px] text-on-surface-variant/50 mb-5">Escolha uma nova senha para sua conta</p>

                <form onSubmit={handleReset} className="space-y-3">
                  <PasswordInput label="Nova senha" value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(p => !p)} />
                  <PasswordInput label="Confirmar senha" value={confirm} onChange={setConfirm} show={showPass} onToggle={() => setShowPass(p => !p)} />
                  {error && <ErrorMsg msg={error} />}
                  <SubmitBtn loading={loading} label="Salvar nova senha" />
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-2 mt-8">
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

// ── Sub-components ──────────────────────────────────────────────────────────

function Input({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-on-surface-variant/60 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-on-surface-variant/60 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 pr-10 text-sm text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-primary/50 transition-colors"
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition-all duration-200 mt-1"
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : label}
    </button>
  );
}

function GoogleBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm py-3 rounded-xl transition-all duration-200 shadow-md"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      Continuar com Google
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-outline-variant/20" />
      <span className="text-[10px] text-on-surface-variant/30 font-medium uppercase tracking-widest">ou</span>
      <div className="flex-1 h-px bg-outline-variant/20" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-[11px] text-rose-400 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2">{msg}</p>;
}

function SuccessMsg({ msg }: { msg: string }) {
  return <p className="text-[11px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">{msg}</p>;
}
