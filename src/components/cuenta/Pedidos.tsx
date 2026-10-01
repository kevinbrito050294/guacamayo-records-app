import { useCallback, useEffect, useState } from 'react';
import { Hash, Package, ShoppingBag, Ticket } from 'lucide-react';
import { pedir, itemsDePedido, formatearFecha, importeUsd, type PedidoCliente } from '../../lib/cuenta';
import { Cargando, MensajeError, Vacio } from './ui';

interface PedidosProps {
  onVerCatalogo: () => void;
}

// Colores por estado. Solo hay tres: son los que escribe el server
// (POST /api/pedidos deja el pedido en 'pendiente' y los PUT /api/pedidos/:id/
// finalizar y /cancelar lo mueven a 'finalizado' o 'cancelado').
// NO se inventan estados intermedios ac??: si aparece uno nuevo entra por el
// fallback de `claseEstado` (gris) y se muestra tal cual lo manda el server,
// en vez de prejuzgar c??mo se ve.
const CLASES_ESTADO: Record<string, string> = {
  pendiente: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  finalizado: 'bg-emerald-500/10 text-emerald-500',
  cancelado: 'bg-red-500/10 text-red-500',
};

// Como se lee el estado en el historial.
const ETIQUETAS_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente de confirmar',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const claseEstado = (estado: string) =>
  CLASES_ESTADO[estado] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

const etiquetaEstado = (estado: string) => ETIQUETAS_ESTADO[estado] || estado;

export function Pedidos({ onVerCatalogo }: PedidosProps) {
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const res = await pedir<PedidoCliente[]>('/api/mis-pedidos');
    if (!res.ok) setError(res.error);
    else setPedidos(Array.isArray(res.data) ? res.data : []);
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <Cargando texto="Buscando tus pedidos..." />;
  if (error) return <MensajeError mensaje={error} onReintentar={cargar} />;

  if (pedidos.length === 0) {
    return (
      <Vacio
        icono={<ShoppingBag size={40} />}
        titulo="Todav??a no compraste"
        texto="Entr?? con tu cuenta antes de comprar y cada pedido te queda guardado ac??, con su estado."
        accion={(
          <button
            type="button"
            onClick={onVerCatalogo}
            className="bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all active:scale-95"
          >
            Ver cat??logo
          </button>
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {pedidos.map((pedido) => {
        const items = itemsDePedido(pedido);
        return (
          <article key={pedido.id_pedido} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">
                  <Hash size={12} className="text-amber-500 shrink-0" />
                  Orden #{pedido.numero_orden || pedido.id_pedido}
                </p>
                <p className="font-black text-slate-900 dark:text-white text-lg uppercase italic tracking-tighter mt-1">
                  {formatearFecha(pedido.fecha)}
                </p>
              </div>
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${claseEstado(pedido.estado)}`}>
                {etiquetaEstado(pedido.estado)}
              </span>
            </div>

            {items.length > 0 && (
              <ul className="space-y-1 mb-4">
                {items.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Package size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                    <span className="font-medium truncate">{item.titulo || 'Vinilo'}</span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 shrink-0">x{item.cantidad ?? 1}</span>
                  </li>
                ))}
              </ul>
            )}
            {items.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic mb-4">Sin detalle de discos en este pedido.</p>
            )}

            {/* El cup??n que se aplic?? y cu??nto se descont?? los guarda el server en
                la fila del pedido (migraci??n 2026-09-29). */}
            {(pedido.cupon_codigo || Number(pedido.descuento_aplicado) > 0) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {pedido.cupon_codigo && (
                  <span className="flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-500">
                    <Ticket size={12} className="shrink-0" /> Cup??n {pedido.cupon_codigo}
                  </span>
                )}
                {Number(pedido.descuento_aplicado) > 0 && (
                  <span className="text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-emerald-500/10 text-emerald-500 font-mono">
                    {/* Mismo "-USD 0.00" que el panel y el carrito, para que el
                        cliente lea el mismo n??mero en las dos pantallas. */}
                    -{importeUsd(pedido.descuento_aplicado)}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/60">
              <div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-black">Total</p>
                {/* El server guarda el total en USD; la divisa preferida es la que eligi?? el cliente al comprar. */}
                <p className="text-xl font-black text-amber-500 tracking-tighter">
                  {importeUsd(pedido.total_pago)}
                </p>
              </div>
              {pedido.divisa_preferida && (
                <span className="text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  Pedido en {pedido.divisa_preferida}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
