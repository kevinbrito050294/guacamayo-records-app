import { useState, type FormEvent } from 'react';
import { LogIn, Mail, Lock, Phone, User, X, Disc, AlertCircle, Shield } from 'lucide-react';
import { useCuenta } from '../../lib/cuenta';
import { Campo } from './ui';
import { BotonGoogle } from './BotonGoogle';

type Modo = 'login' | 'registro';

interface AccesoProps {
  onVolver: () => void;
  onAccesoAdmin: () => void;
  modoInicial?: Modo;
}

/**
 * Login y registro en la misma pantalla (tabs), con el mismo lenguaje visual
 * que el AdminLogin. El error que devuelve el server se muestra tal cual.
 */
export function Acceso({ onVolver, onAccesoAdmin, modoInicial = 'login' }: AccesoProps) {
  const { login, registro, loginConGoogle, cargando: cargandoSesion } = useCuenta();

  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setError('');
  };

  const manejarEnvio = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError('');

    // La validaci??n real (nombre, email, largo de la clave) la hace el server:
    // se manda igual y el mensaje se muestra tal cual vuelve.
    setEnviando(true);
    const res = modo === 'login'
      ? await login({ email: email.trim(), password })
      : await registro({ nombre: nombre.trim(), email: email.trim(), password, telefono: telefono.trim() });
    setEnviando(false);

    if (!res.ok) setError(res.error);
    // Si sali?? bien, la pagina de cuenta ya se muestra sola: no hace falta navegar.
  };

  const manejarCredencialGoogle = async (idToken: string) => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    const res = await loginConGoogle(idToken);
    setEnviando(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-1 py-4">
      <button
        type="button"
        onClick={onVolver}
        aria-label="Volver al cat??logo"
        className="self-end mb-4 p-2 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
      >
        <X size={22} />
      </button>

      <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl dark:shadow-none border border-slate-100 dark:border-slate-800 w-full max-w-md text-center transition-colors">
        <div className="bg-amber-50 dark:bg-amber-500/10 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
          <User className="w-12 h-12 text-amber-500 dark:text-amber-400" />
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 italic uppercase tracking-tighter">
          {modo === 'login' ? <>MI <span className="text-amber-500">CUENTA</span></> : <>NUEVA <span className="text-amber-500">CUENTA</span></>}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium text-sm">
          {modo === 'login'
            ? 'Entr?? para ver tus pedidos, favoritos y direcciones.'
            : 'Guard?? tus pedidos y arm?? tu lista de favoritos.'}
        </p>

        {/* TABS */}
        <div className="flex p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl mb-8" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'login'}
            onClick={() => cambiarModo('login')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${modo === 'login'
              ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
              : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'registro'}
            onClick={() => cambiarModo('registro')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${modo === 'registro'
              ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
              : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={manejarEnvio} className="space-y-4 text-left">
          {modo === 'registro' && (
            <Campo
              id="cuenta-nombre"
              etiqueta="Nombre"
              valor={nombre}
              onChange={setNombre}
              placeholder="Tu nombre y apellido"
              autoComplete="name"
              maxLength={120}
              required
              icono={<User size={18} />}
            />
          )}

          <Campo
            id="cuenta-email"
            etiqueta="Email"
            tipo="email"
            valor={email}
            onChange={setEmail}
            placeholder="tunombre@email.com"
            autoComplete="email"
            required
            icono={<Mail size={18} />}
          />

          <Campo
            id="cuenta-password"
            etiqueta="Contrase??a"
            tipo="password"
            valor={password}
            onChange={setPassword}
            placeholder="????????????????????????"
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            minLength={modo === 'registro' ? 8 : undefined}
            required
            icono={<Lock size={18} />}
            permitirVisibilidad
            ayuda={modo === 'registro' ? 'M??nimo 8 caracteres.' : undefined}
          />

          {modo === 'registro' && (
            <Campo
              id="cuenta-telefono"
              etiqueta="Tel??fono (opcional)"
              tipo="tel"
              valor={telefono}
              onChange={setTelefono}
              placeholder="+54 9 11 6447 5028"
              autoComplete="tel"
              maxLength={32}
              icono={<Phone size={18} />}
            />
          )}

          {error && (
            <div
              role="alert"
              className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-500/10 py-4 px-4 rounded-2xl border border-red-100 dark:border-red-500/20"
            >
              <AlertCircle size={18} className="shrink-0" />
              <span className="text-sm font-bold uppercase tracking-tight">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || cargandoSesion}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all shadow-xl shadow-amber-500/10 active:scale-95 disabled:opacity-60 disabled:active:scale-100"
          >
            {enviando ? <Disc size={18} className="animate-spin" /> : <LogIn size={18} />}
            {enviando ? 'ESPERANDO...' : modo === 'login' ? 'INGRESAR' : 'CREAR CUENTA'}
          </button>
        </form>

        <div className="mt-6">
          <BotonGoogle onCredencial={manejarCredencialGoogle} onError={setError} />
        </div>

        <button
          type="button"
          onClick={onAccesoAdmin}
          className="mt-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
        >
          <Shield size={13} />
          Acceso administrativo
        </button>

        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-8 uppercase tracking-widest">
          Guacamayo Records &copy; 2026
        </p>
      </div>
    </div>
  );
}
