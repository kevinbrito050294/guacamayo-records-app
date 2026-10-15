import { useEffect, useState, type ReactNode } from 'react';
import { Heart, LogOut, MapPin, ShoppingBag, X, Feather, Clock3 } from 'lucide-react';
import { pedir, useCuenta, imgUrl, type Direccion, type PedidoCliente, type ResultadoAccion } from '../../lib/cuenta';
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
  onAgregarAlCarrito: (viniloId: number) => Promise<ResultadoAccion>;
}

export function CuentaPanel({ onVolver, divisa, tasas, onAgregarAlCarrito }: CuentaPanelProps) {
  const { usuario, favoritos, logout, saldoRecompensas } = useCuenta();
  const [pestana, setPestana] = useState<Pestana>('pedidos');
  const [resumen, setResumen] = useState<{ pedidos: PedidoCliente[]; direcciones: Direccion[] } | null>(null);
  const [errorResumen, setErrorResumen] = useState('');

  useEffect(() => {
    let vigente = true;
    void Promise.all([pedir<PedidoCliente[]>('/api/mis-pedidos'), pedir<Direccion[]>('/api/direcciones')]).then(([pedidos, direcciones]) => {
      if (!vigente) return;
      if (!pedidos.ok || !direcciones.ok) setErrorResumen(pedidos.error || direcciones.error);
      setResumen({ pedidos: pedidos.ok && Array.isArray(pedidos.data) ? pedidos.data : [], direcciones: direcciones.ok && Array.isArray(direcciones.data) ? direcciones.data : [] });
    });
    return () => { vigente = false; };
  }, []);

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
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut size={20} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver al catálogo"
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Resumen de cuenta">
        <Resumen icono={<ShoppingBag size={17} />} titulo="Pedidos" valor={resumen ? String(resumen.pedidos.length) : '...'} />
        <Resumen icono={<Clock3 size={17} />} titulo="Pendientes" valor={resumen ? String(resumen.pedidos.filter((p) => p.estado === 'pendiente').length) : '...'} />
        <Resumen icono={<Heart size={17} />} titulo="Favoritos" valor={String(favoritos.length)} />
        <Resumen icono={<Feather size={17} />} titulo="Plumas" valor={saldoRecompensas ? String(saldoRecompensas.unidades) : errorResumen ? '--' : '...'} />
      </section>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-2"><MapPin size={14} className="text-amber-500" /> Dirección principal: {resumen?.direcciones.find((d) => Number(d.es_default) === 1)?.apodo || (resumen ? 'Sin definir' : 'Cargando...')}</span>
        {errorResumen && <span className="text-amber-600 dark:text-amber-400" role="status">No pudimos completar el resumen: {errorResumen}</span>}
      </div>

      {/* PESTAÑAS */}
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
          sub="Envíos"
        />
      </div>

      {/* CONTENIDO */}
      <div role="tabpanel">
        {pestana === 'pedidos' && <Pedidos onVerCatalogo={onVolver} />}
        {pestana === 'favoritos' && <Favoritos divisa={divisa} tasas={tasas} onVerCatalogo={onVolver} onAgregarAlCarrito={onAgregarAlCarrito} />}
        {pestana === 'direcciones' && <Direcciones />}
      </div>
    </div>
  );
}

function Resumen({ icono, titulo, valor }: { icono: ReactNode; titulo: string; valor: string }) {
  return <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4"><div className="flex items-center gap-2 text-amber-500">{icono}<span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{titulo}</span></div><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{valor}</p></div>;
}
