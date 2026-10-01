import { useCallback, useEffect, useState } from 'react';
import { Heart, HeartOff, Disc, Trash2, AlertCircle } from 'lucide-react';
import { useCuenta, imgUrl } from '../../lib/cuenta';
import type { ConfiguracionDivisa } from '../../types/database';
import { Cargando, MensajeError, Vacio } from './ui';

type Divisa = 'USD' | 'ARS' | 'USDT';

interface FavoritosProps {
  divisa: Divisa;
  tasas: ConfiguracionDivisa[];
  onVerCatalogo: () => void;
}

export function Favoritos({ divisa, tasas, onVerCatalogo }: FavoritosProps) {
  const { favoritos, alternarFavorito, refrescarFavoritos, vaciarFavoritos } = useCuenta();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const res = await refrescarFavoritos();
    if (!res.ok) setError(res.error);
    setCargando(false);
  }, [refrescarFavoritos]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Misma conversion que el catalogo (Catalog.tsx) para que el precio se vea igual.
  const tasaBlue = tasas.find((t) => t.tipo === 'DOLAR_BLUE')?.tasa || 1;
  const tasaUsdt = tasas.find((t) => t.tipo === 'USDT')?.tasa || 1;

  const formatearPrecio = (usd: number) => {
    if (divisa === 'USD') return `USD ${usd.toFixed(2)}`;
    if (divisa === 'USDT') return `${((usd * tasaBlue) / tasaUsdt).toFixed(2)} USDT`;
    return `$${Math.round(usd * tasaBlue).toLocaleString('es-AR')}`;
  };

  const quitar = async (viniloId: number) => {
    setError('');
    const res = await alternarFavorito(viniloId);
    if (!res.ok) setError(res.error);
  };

  const vaciar = async () => {
    if (!confirm('??Vaciar tu lista de favoritos?')) return;
    setError('');
    setTrabajando(true);
    const res = await vaciarFavoritos();
    setTrabajando(false);
    if (!res.ok) setError(res.error);
  };

  if (cargando) return <Cargando texto="Cargando favoritos..." />;
  if (error && favoritos.length === 0) return <MensajeError mensaje={error} onReintentar={cargar} />;

  if (favoritos.length === 0) {
    return (
      <Vacio
        icono={<Heart size={40} />}
        titulo="Sin favoritos todav??a"
        texto="Toc?? el coraz??n en cualquier disco del cat??logo y queda guardado ac??."
        accion={(
          <button
            type="button"
            onClick={onVerCatalogo}
            className="bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all active:scale-95"
          >
            Explorar cat??logo
          </button>
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {favoritos.length} {favoritos.length === 1 ? 'disco guardado' : 'discos guardados'}
        </p>
        <button
          type="button"
          onClick={vaciar}
          disabled={trabajando}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-100 dark:border-red-500/20 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} />
          Vaciar favoritos
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 py-3 px-4 rounded-2xl">
          <AlertCircle size={16} className="shrink-0" />
          <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {favoritos.map((favorito) => {
          // El LEFT JOIN devuelve nulls si el vinilo ya no existe en el inventario.
          const disponible = Boolean(favorito.titulo);
          const foto = disponible ? imgUrl(favorito.imagen_url) : '';
          return (
            <article key={favorito.id} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden flex flex-col transition-colors">
              <div className="aspect-square bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                {foto ? (
                  <img src={foto} alt={favorito.titulo || 'Vinilo'} className="w-full h-full object-cover" />
                ) : (
                  <Disc size={40} className="text-slate-300 dark:text-slate-600" />
                )}
                {!disponible && (
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-widest bg-slate-900/90 dark:bg-slate-950/90 text-white dark:text-amber-500 px-3 py-1.5 rounded-full">
                    Vinilo no disponible
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <p className="font-black text-slate-900 dark:text-white uppercase italic tracking-tighter truncate">
                  {favorito.titulo || 'Vinilo no disponible'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mb-3">
                  {favorito.artista || '???'}
                </p>

                {favorito.precio_venta !== null && disponible ? (
                  <p className="text-lg font-black text-amber-500 tracking-tighter mb-1">
                    {formatearPrecio(Number(favorito.precio_venta))}
                  </p>
                ) : (
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Sin precio</p>
                )}

                {disponible && Number(favorito.stock_actual) === 0 && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Agotado</p>
                )}

                <button
                  type="button"
                  onClick={() => quitar(Number(favorito.vinilo_id))}
                  aria-label={`Quitar ${favorito.titulo || 'vinilo'} de favoritos`}
                  className="mt-auto flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-500/40 text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  <HeartOff size={14} />
                  Quitar
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
