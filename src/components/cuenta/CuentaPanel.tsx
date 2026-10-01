import { useState } from 'react';
import { Heart, LogOut, MapPin, ShoppingBag, X } from 'lucide-react';
import { useCuenta, imgUrl } from '../../lib/cuenta';
import type { ConfiguracionDivisa } from '../../types/database';
import { PestanaBoton } from './ui';
import { Pedidos } from './Pedidos';
import { Favoritos } from './Favoritos';
import { Direcciones } from './Direcciones';

type Pestana = 'pedidos' | 'favoritos' | 'direcciones';

interface CuentaPanelProps {
  onVolver: () => void;
  divisa: 'USD' | 'ARS' | 'USDT';
  tasas: ConfiguracionDivisa[];
}

export function CuentaPanel({ onVolver, divisa, tasas }: CuentaPanelProps) {
  const { usuario, favoritos, logout } = useCuenta();
  const [pestana, setPestana] = useState<Pestana>('pedidos');

  if (!usuario) return null;

  const inicial = (usuario.nombre || usuario.email || '?').charAt(0).toUpperCase();
  const avatar = imgUrl(usuario.avatar_url);

  return (
    <div className="max-w-5xl mx-auto py-4 space-y-6">
      {/* CABECERA */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm p-5 sm:p-8 flex items-center gap-4 sm:gap-5 transition-colors">
        <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl overflow-hidden bg-amber-500 flex items-center justify-center">
          {avatar
            ? <img src={avatar} alt="" className="w-full h-full object-cover" />
            : <span className="text-2xl font-black italic text-slate-950">{inicial}</span>}
        </div>

        <div className="flex-grow min-w-0">
          <h1 className="font-black text-slate-900 dark:text-white uppercase italic tracking-tighter text-xl sm:text-2xl truncate">
            {usuario.nombre}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium truncate">{usuario.email}</p>
          {usuario.telefono && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 truncate">{usuario.telefono}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { void logout(); onVolver(); }}
            aria-label="Cerrar sesi??n"
            title="Cerrar sesi??n"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut size={20} />
            <span className="hidden sm:inline">Cerrar sesi??n</span>
          </button>
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver al cat??logo"
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      {/* PESTA??AS */}
      <div role="tablist" aria-label="Secciones de la cuenta" className="grid grid-cols-3 gap-3 sm:gap-4">
        <PestanaBoton
          activa={pestana === 'pedidos'}
          onClick={() => setPestana('pedidos')}
          icono={<ShoppingBag size={18} className="text-amber-500" />}
          titulo="Pedidos"
          sub="Historial"
        />
        <PestanaBoton
          activa={pestana === 'favoritos'}
          onClick={() => setPestana('favoritos')}
          icono={<Heart size={18} className="text-amber-500" />}
          titulo="Favoritos"
          sub={`${favoritos.length}`}
        />
        <PestanaBoton
          activa={pestana === 'direcciones'}
          onClick={() => setPestana('direcciones')}
          icono={<MapPin size={18} className="text-amber-500" />}
          titulo="Direcciones"
          sub="Env??os"
        />
      </div>

      {/* CONTENIDO */}
      <div role="tabpanel">
        {pestana === 'pedidos' && <Pedidos onVerCatalogo={onVolver} />}
        {pestana === 'favoritos' && <Favoritos divisa={divisa} tasas={tasas} onVerCatalogo={onVolver} />}
        {pestana === 'direcciones' && <Direcciones />}
      </div>
    </div>
  );
}
