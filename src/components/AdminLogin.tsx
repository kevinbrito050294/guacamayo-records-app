import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, ShieldAlert } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (pass: string) => void;
  error: string;
}

export function AdminLogin({ onLogin, error }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  // Verificar si ya hay una sesión activa al cargar el componente
  useEffect(() => {
    const sessionActive = localStorage.getItem('admin_session_active');
    if (sessionActive === 'true') {
      setIsBlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Si está bloqueado, no permitir el intento de login
    if (isBlocked) return;
    onLogin(password);
  };

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in zoom-in duration-500 px-4">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl border border-red-100 dark:border-red-900/30 w-full max-w-md text-center">
          <div className="bg-red-50 dark:bg-red-500/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase italic">Acceso Denegado</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Ya existe una sesión de administración abierta en otra pestaña o ventana. 
            Cierra la otra pestaña para poder ingresar aquí.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white py-4 rounded-2xl font-black text-xs uppercase"
          >
            REINTENTAR CONEXIÓN
          </button>
        </div>
      </div>
    );
  }

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
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative text-left">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-[0.2em]">
              Contraseña Maestra
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-2 px-4 py-5 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-center text-2xl tracking-[0.5em] text-slate-900 dark:text-white"
              autoFocus
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-3 justify-center text-red-500 bg-red-50 dark:bg-red-500/10 py-4 rounded-2xl border border-red-100 dark:border-red-500/20 animate-shake">
              <AlertCircle size={18} />
              <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all shadow-xl shadow-amber-500/10 active:scale-95"
          >
            DESBLOQUEAR PANEL
          </button>
        </form>

        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-10 uppercase tracking-widest">
          Guacamayo Records &copy; 2026
        </p>
      </div>
    </div>
  );
}