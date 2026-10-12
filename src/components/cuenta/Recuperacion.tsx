import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Disc, KeyRound, Lock, Mail } from 'lucide-react';
import { restablecerPassword, solicitarRecuperacion } from '../../lib/cuenta';
import { Campo } from './ui';

interface RecuperacionProps {
  token?: string;
  onVolverLogin: () => void;
  onRestablecida: () => void;
}

export function Recuperacion({ token, onVolverLogin, onRestablecida }: RecuperacionProps) {
  return token
    ? <NuevaPassword token={token} onVolverLogin={onVolverLogin} onRestablecida={onRestablecida} />
    : <SolicitudRecuperacion onVolverLogin={onVolverLogin} />;
}

function Marco({ children, titulo, texto, onVolverLogin }: {
  children: ReactNode;
  titulo: ReactNode;
  texto: string;
  onVolverLogin: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-1 py-4">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl dark:shadow-none border border-slate-100 dark:border-slate-800 w-full max-w-md text-center">
        <div className="bg-amber-50 dark:bg-amber-500/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
          <KeyRound className="w-12 h-12 text-amber-500 dark:text-amber-400" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 italic uppercase tracking-tighter">{titulo}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium text-sm">{texto}</p>
        {children}
        <button type="button" onClick={onVolverLogin} className="mt-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
          <ArrowLeft size={13} /> Volver a ingresar
        </button>
      </div>
    </div>
  );
}

function SolicitudRecuperacion({ onVolverLogin }: { onVolverLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    const res = await solicitarRecuperacion(email.trim());
    setEnviando(false);
    if (res.ok) setEnviado(true);
    else setError('No pudimos procesar la solicitud. Probá de nuevo más tarde.');
  };

  return (
    <Marco titulo={<>RECUPERÁ TU <span className="text-amber-500">CLAVE</span></>} texto="Ingresá tu email y, si existe una cuenta, recibirás instrucciones para crear una nueva contraseña." onVolverLogin={onVolverLogin}>
      {enviado ? (
        <div className="flex items-start gap-3 text-left text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-4 px-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <span className="text-sm font-bold">Si el email corresponde a una cuenta, vas a recibir un enlace para restablecer la contraseña.</span>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4 text-left">
          <Campo id="recuperar-email" etiqueta="Email" tipo="email" valor={email} onChange={setEmail} placeholder="tunombre@email.com" autoComplete="email" required icono={<Mail size={18} />} />
          {error && <div role="alert" className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-500/10 py-4 px-4 rounded-2xl border border-red-100 dark:border-red-500/20"><AlertCircle size={18} className="shrink-0" /><span className="text-sm font-bold">{error}</span></div>}
          <button type="submit" disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all shadow-xl shadow-amber-500/10 disabled:opacity-60">
            {enviando ? <Disc size={18} className="animate-spin" /> : <Mail size={18} />} {enviando ? 'ENVIANDO...' : 'ENVIAR INSTRUCCIONES'}
          </button>
        </form>
      )}
    </Marco>
  );
}

function NuevaPassword({ token, onVolverLogin, onRestablecida }: { token: string; onVolverLogin: () => void; onRestablecida: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (password !== confirmacion) { setError('Las contraseñas no coinciden.'); return; }
    setEnviando(true);
    setError('');
    const res = await restablecerPassword(token, password);
    setEnviando(false);
    if (!res.ok) { setError(res.error); return; }
    onRestablecida();
    setExito(true);
  };

  return (
    <Marco titulo={exito ? <>CLAVE <span className="text-amber-500">ACTUALIZADA</span></> : <>NUEVA <span className="text-amber-500">CONTRASEÑA</span></>} texto={exito ? 'Tu contraseña fue actualizada correctamente.' : 'Elegí una contraseña nueva para tu cuenta.'} onVolverLogin={onVolverLogin}>
      {exito ? <div className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 py-4 px-4 rounded-2xl" role="status"><CheckCircle2 size={18} /><span className="text-sm font-bold">Ya podés volver a ingresar.</span></div> : (
        <form onSubmit={enviar} className="space-y-4 text-left">
          <Campo id="nueva-password" etiqueta="Nueva contraseña" tipo="password" valor={password} onChange={setPassword} placeholder="••••••••" autoComplete="new-password" minLength={8} required icono={<Lock size={18} />} permitirVisibilidad ayuda="Mínimo 8 caracteres." />
          <Campo id="confirmar-password" etiqueta="Repetí la contraseña" tipo="password" valor={confirmacion} onChange={setConfirmacion} placeholder="••••••••" autoComplete="new-password" minLength={8} required icono={<Lock size={18} />} permitirVisibilidad />
          {error && <div role="alert" className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-500/10 py-4 px-4 rounded-2xl border border-red-100 dark:border-red-500/20"><AlertCircle size={18} className="shrink-0" /><span className="text-sm font-bold">{error}</span></div>}
          <button type="submit" disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all shadow-xl shadow-amber-500/10 disabled:opacity-60">
            {enviando ? <Disc size={18} className="animate-spin" /> : <Lock size={18} />} {enviando ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA'}
          </button>
        </form>
      )}
    </Marco>
  );
}
