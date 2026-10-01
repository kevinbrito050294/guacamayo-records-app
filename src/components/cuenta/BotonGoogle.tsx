import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

// Boton de Google Identity Services. Solo se monta si hay client id configurado:
// sin VITE_GOOGLE_CLIENT_ID no se pide el script de Google ni se manda nada.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SRC_GOOGLE = 'https://accounts.google.com/gsi/client';

// El script se inyecta una sola vez por sesion de la pagina.
let promesaScript: Promise<void> | null = null;

function cargarScriptGoogle(): Promise<void> {
  if (promesaScript) return promesaScript;
  promesaScript = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${SRC_GOOGLE}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = SRC_GOOGLE;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google'));
    document.head.appendChild(script);
  });
  return promesaScript;
}

interface RespuestaCredencial { credential: string }

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: RespuestaCredencial) => void }) => void;
      renderButton: (elemento: HTMLElement, opciones: Record<string, unknown>) => void;
    };
  };
}

const googleDe = (): GoogleIdentity | undefined => (window as unknown as { google?: GoogleIdentity }).google;

interface BotonGoogleProps {
  onCredencial: (idToken: string) => void;
  onError?: (mensaje: string) => void;
}

export function BotonGoogle({ onCredencial, onError }: BotonGoogleProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [fallo, setFallo] = useState('');

  // En refs para no reinicializar el boton de Google en cada render del padre.
  const cb = useRef(onCredencial);
  const cbError = useRef(onError);
  useEffect(() => { cb.current = onCredencial; cbError.current = onError; });

  useEffect(() => {
    const clientId = CLIENT_ID;
    if (!clientId) return;

    let vivo = true;
    cargarScriptGoogle()
      .then(() => {
        const google = googleDe();
        if (!vivo || !google || !contenedor.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (respuesta) => { if (respuesta?.credential) cb.current(respuesta.credential); },
        });
        google.accounts.id.renderButton(contenedor.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 260,
          text: 'continue_with',
          locale: 'es',
        });
      })
      .catch(() => {
        if (!vivo) return;
        const mensaje = 'No se pudo cargar el acceso con Google. Usá tu email y contraseña.';
        setFallo(mensaje);
        cbError.current?.(mensaje);
      });

    return () => { vivo = false; };
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">o continuá con</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* GIS mete un iframe con ancho fijo: el contenedor evita que desborde el card. */}
      <div className="flex justify-center overflow-hidden">
        <div ref={contenedor} />
      </div>

      {fallo && (
        <div role="alert" className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-500/10 py-3 px-4 rounded-2xl">
          <AlertCircle size={16} className="shrink-0" />
          <span className="text-xs font-bold uppercase tracking-tight">{fallo}</span>
        </div>
      )}
    </div>
  );
}
