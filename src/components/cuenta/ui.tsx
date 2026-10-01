import { useState, type ReactNode } from 'react';
import { AlertCircle, Disc, Eye, EyeOff, X } from 'lucide-react';

/**
 * Piezas visuales compartidas por el login y el panel de cuenta.
 * Estilan al AdminLogin/AdminPanel pero en escala cliente.
 */

// --- Input con label asociado (el id enlaza label e input) ---

interface CampoProps {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  tipo?: string;
  placeholder?: string;
  ayuda?: string;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  icono?: ReactNode;
  className?: string;
  permitirVisibilidad?: boolean;
}

export function Campo({
  id, etiqueta, valor, onChange, tipo = 'text', placeholder, ayuda,
  autoComplete, required, maxLength, minLength, icono, className = '', permitirVisibilidad = false,
}: CampoProps) {
  const [mostrarValor, setMostrarValor] = useState(false);
  const esContrasena = tipo === 'password';
  const tipoVisible = permitirVisibilidad && esContrasena && mostrarValor ? 'text' : tipo;

  return (
    <div className="text-left">
      <label htmlFor={id} className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
        {etiqueta}
      </label>
      <div className="relative mt-2">
        {icono && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none">
            {icono}
          </span>
        )}
        <input
          id={id}
          type={tipoVisible}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          className={`w-full py-4 ${permitirVisibilidad && esContrasena ? 'pr-12' : 'pr-4'} bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-900 dark:text-white text-base ${icono ? 'pl-12' : 'pl-4'} ${className}`}
        />
        {permitirVisibilidad && esContrasena && (
          <button
            type="button"
            onClick={() => setMostrarValor((actual) => !actual)}
            aria-label={mostrarValor ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors"
          >
            {mostrarValor ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-[10px] text-slate-400 dark:text-slate-600 mt-2 ml-2 font-medium">
          {ayuda}
        </p>
      )}
    </div>
  );
}

// --- Estados de carga / error / vacio ---

export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
      <Disc className="w-10 h-10 text-amber-500 animate-spin mb-3 opacity-40" />
      <p className="text-slate-400 dark:text-slate-500 font-mono text-[10px] uppercase tracking-widest">{texto}</p>
    </div>
  );
}

export function MensajeError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row items-center gap-3 text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 py-4 px-5 rounded-2xl"
    >
      <AlertCircle size={18} className="shrink-0" />
      <span className="flex-grow text-sm font-bold uppercase tracking-tight text-center sm:text-left">{mensaje}</span>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="shrink-0 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, accion }: { icono: ReactNode; titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl mb-5 text-slate-300 dark:text-slate-700">
        {icono}
      </div>
      <p className="font-black uppercase italic tracking-tighter text-slate-900 dark:text-white text-lg">{titulo}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs font-medium">{texto}</p>
      {accion && <div className="mt-6">{accion}</div>}
    </div>
  );
}

// --- Toast: reemplaza los alert() para errores de una sola operacion ---

export function Aviso({ mensaje, onCerrar }: { mensaje: string; onCerrar: () => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-2rem)] max-w-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 px-5 py-4 rounded-2xl shadow-2xl">
        <AlertCircle size={18} className="shrink-0" />
        <span className="flex-grow text-xs font-black uppercase tracking-tight">{mensaje}</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="shrink-0 p-1 opacity-60 hover:opacity-100 transition-opacity">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// --- Pestaña: adaptation del TabButton del AdminPanel (escala cliente) ---

export function PestanaBoton({
  activa, onClick, icono, titulo, sub,
}: { activa: boolean; onClick: () => void; icono: ReactNode; titulo: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={activa}
      role="tab"
      className={`p-4 rounded-2xl border-2 text-left transition-all ${activa
        ? 'border-slate-900 dark:border-amber-500 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-amber-500/50'
        }`}
    >
      <div className={`mb-2 p-2 rounded-lg inline-block ${activa ? 'bg-slate-800 dark:bg-amber-600/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
        {icono}
      </div>
      <p className="font-bold text-xs">{titulo}</p>
      <p className="text-[10px] uppercase opacity-60 tracking-tighter">{sub}</p>
    </button>
  );
}
