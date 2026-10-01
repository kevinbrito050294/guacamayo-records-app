import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (email: string, password: string) => void;
  error: string;
  cargando: boolean;
}

export function AdminLogin({ onLogin, error, cargando }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    onLogin(email.trim(), password);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in duration-500 px-4">
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl dark:shadow-none border border-slate-100 dark:border-slate-800 w-full max-w-md text-center transition-colors">
        
        <div className="bg-amber-50 dark:bg-amber-500/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-inner">
          <Lock className="w-12 h-12 text-amber-500 dark:text-amber-400" />
        </div>
        
        <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2 italic uppercase tracking-tighter">
          MODO <span className="text-amber-500">ADMIN</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium">
          Identifícate para gestionar el inventario de la tienda.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative text-left">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-[0.2em]">
              Email
            </label>
            <div className="relative mt-2">
              <Mail className="w-5 h-5 text-slate-400 dark:text-slate-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                placeholder="admin@guacamayorecords.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-900 dark:text-white"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="relative text-left">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-[0.2em]">
              Contraseña
            </label>
            <div className="relative mt-2">
            <input
              type={mostrarPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 pr-12 py-5 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-center text-2xl tracking-[0.5em] text-slate-900 dark:text-white"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setMostrarPassword((actual) => !actual)}
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors"
            >
              {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            </div>
          </div>
          
          {error && (
            <div className="flex items-center gap-3 justify-center text-red-500 bg-red-50 dark:bg-red-500/10 py-4 rounded-2xl border border-red-100 dark:border-red-500/20 animate-shake">
              <AlertCircle size={18} />
              <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
            </div>
          )}
          
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all shadow-xl shadow-amber-500/10 active:scale-95 disabled:opacity-60 disabled:active:scale-100"
          >
            {cargando ? 'VERIFICANDO...' : 'DESBLOQUEAR PANEL'}
          </button>
        </form>

        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-10 uppercase tracking-widest">
          Guacamayo Records &copy; 2026
        </p>
      </div>
    </div>
  );
}
