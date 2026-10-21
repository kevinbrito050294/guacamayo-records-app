import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus, Save, PackageCheck, RefreshCw, X } from 'lucide-react';
import { VinylForm } from './VinylForm';

type CompraItem = {
  id: number;
  titulo: string;
  artista: string;
  genero: string | null;
  calidad: string | null;
  pais_origen: string | null;
  cantidad_comprada: number;
  cantidad_recibida: number;
  precio_unitario_usdt: number | string;
  costo_unitario_usdt: number | string;
  estado: string;
  vinilo_id: number | null;
};

type Compra = {
  id: number;
  proveedor: string;
  proveedor_pais: string;
  estado: string;
  fecha_compra: string | null;
  tasa_ars_usdt: number | string | null;
  tasa_ves_usdt: number | string | null;
  total_productos_ves: number | string;
  total_productos_usdt: number | string;
  responsable_nombre: string | null;
  items: CompraItem[];
};

type ItemDraft = {
  titulo: string;
  artista: string;
  genero: string;
  calidad: string;
  pais_origen: string;
  cantidad_comprada: string;
  precio_unitario_usdt: string;
  codigo_proveedor: string;
};

const itemVacio = (): ItemDraft => ({
  titulo: '', artista: '', genero: '', calidad: 'VG', pais_origen: '', cantidad_comprada: '1', precio_unitario_usdt: '', codigo_proveedor: '',
});

export function ComprasPanel({ getApiUrl, onInventoryChanged }: { getApiUrl: () => string; onInventoryChanged: () => void }) {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [proveedor, setProveedor] = useState('');
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().slice(0, 10));
  const [tasaArsUsdt, setTasaArsUsdt] = useState('');
  const [tasaVesUsdt, setTasaVesUsdt] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([itemVacio()]);
  const [recepcion, setRecepcion] = useState<{ item: CompraItem; codigo: string; cantidad: number } | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const res = await fetch(`${getApiUrl()}/api/admin/compras`, { credentials: 'include', cache: 'no-store' });
      const data: unknown = await res.json().catch(() => []);
      if (!res.ok) throw new Error(typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'No se pudieron cargar las compras');
      setCompras(Array.isArray(data) ? data as Compra[] : []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las compras');
    } finally {
      setCargando(false);
    }
  }, [getApiUrl]);

  useEffect(() => { void cargar(); }, [cargar]);

  const actualizarItem = (indice: number, campo: keyof ItemDraft, valor: string) => {
    setItems(prev => prev.map((item, actual) => actual === indice ? { ...item, [campo]: valor } : item));
  };

  const guardarCompra = async (event: React.FormEvent) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/compras`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor, fecha_compra: fechaCompra, tasa_ars_usdt: Number(tasaArsUsdt), tasa_ves_usdt: Number(tasaVesUsdt),
          items: items.map(item => ({ ...item, cantidad_comprada: Number(item.cantidad_comprada), precio_unitario_usdt: Number(item.precio_unitario_usdt) })),
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'No se pudo guardar la compra');
      setMostrarNueva(false);
      setProveedor('');
      setItems([itemVacio()]);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la compra');
    } finally {
      setGuardando(false);
    }
  };

  const prepararRecepcion = async (item: CompraItem) => {
    setError('');
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/compras/items/${item.id}/preparar-inventario`, { credentials: 'include', cache: 'no-store' });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'No se pudo preparar la recepción');
      if (typeof data === 'object' && data !== null && 'ya_incorporado' in data && data.ya_incorporado) {
        setError('Este item ya fue incorporado al inventario.');
        return;
      }
      const preparado = data as { codigo_sugerido: string; cantidad_pendiente: number };
      setRecepcion({ item, codigo: preparado.codigo_sugerido, cantidad: preparado.cantidad_pendiente });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar la recepción');
    }
  };

  if (recepcion) {
    return (
      <section className="space-y-4">
        <button type="button" onClick={() => setRecepcion(null)} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-amber-500"><ArrowLeft size={16} /> Volver a compras</button>
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Recepción física: código sugerido <strong>{recepcion.codigo}</strong>. El servidor lo volverá a validar al guardar para evitar duplicados.
        </div>
        <VinylForm
          compraRecepcion={{ compraItemId: recepcion.item.id, codigoSugerido: recepcion.codigo, cantidadRecibida: recepcion.cantidad }}
          initialData={{ titulo: recepcion.item.titulo, artista: recepcion.item.artista, genero: recepcion.item.genero || 'Rock', calidad: (recepcion.item.calidad || 'VG') as 'NM' | 'EX' | 'VG+' | 'VG' | 'G', pais_origen: recepcion.item.pais_origen || '', precio_venta: '', stock_actual: String(recepcion.cantidad), imagen_url: '' }}
          onSuccess={() => { setRecepcion(null); void cargar(); onInventoryChanged(); }}
        />
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-xl font-black uppercase dark:text-white"><ClipboardList className="text-amber-500" /> Compras y abastecimiento</h2><p className="mt-1 text-xs text-slate-500">Las compras no entran al catálogo hasta confirmar su recepción física.</p></div>
        <button type="button" onClick={() => setMostrarNueva(value => !value)} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-xs font-black uppercase text-slate-950"><Plus size={16} /> Nueva compra</button>
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-xs font-bold text-red-500">{error}</div>}

      {mostrarNueva && (
        <form onSubmit={guardarCompra} className="space-y-4 rounded-2xl border border-amber-500/20 bg-slate-50 p-4 dark:bg-slate-800/40">
          <div className="grid gap-3 md:grid-cols-4">
            <input required value={proveedor} onChange={event => setProveedor(event.target.value)} placeholder="Proveedor" className="rounded-xl p-3 text-sm dark:bg-slate-900 dark:text-white" />
            <input type="date" value={fechaCompra} onChange={event => setFechaCompra(event.target.value)} className="rounded-xl p-3 text-sm dark:bg-slate-900 dark:text-white" />
            <input required type="number" step="0.000001" value={tasaArsUsdt} onChange={event => setTasaArsUsdt(event.target.value)} placeholder="ARS por USDT" className="rounded-xl p-3 text-sm dark:bg-slate-900 dark:text-white" />
            <input required type="number" step="0.000001" value={tasaVesUsdt} onChange={event => setTasaVesUsdt(event.target.value)} placeholder="VES por USDT" className="rounded-xl p-3 text-sm dark:bg-slate-900 dark:text-white" />
          </div>
          {items.map((item, indice) => (
            <div key={indice} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 md:grid-cols-4">
              <input required value={item.titulo} onChange={event => actualizarItem(indice, 'titulo', event.target.value)} placeholder="Título" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              <input required value={item.artista} onChange={event => actualizarItem(indice, 'artista', event.target.value)} placeholder="Artista" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              <input value={item.genero} onChange={event => actualizarItem(indice, 'genero', event.target.value)} placeholder="Género" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              <select value={item.calidad} onChange={event => actualizarItem(indice, 'calidad', event.target.value)} className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white">{['NM', 'EX', 'VG+', 'VG', 'G'].map(value => <option key={value}>{value}</option>)}</select>
              <input value={item.pais_origen} onChange={event => actualizarItem(indice, 'pais_origen', event.target.value)} placeholder="País" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              <input required type="number" min="1" value={item.cantidad_comprada} onChange={event => actualizarItem(indice, 'cantidad_comprada', event.target.value)} placeholder="Cantidad" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              <input required type="number" min="0" step="0.000001" value={item.precio_unitario_usdt} onChange={event => actualizarItem(indice, 'precio_unitario_usdt', event.target.value)} placeholder="Precio unitario USDT" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              <input value={item.codigo_proveedor} onChange={event => actualizarItem(indice, 'codigo_proveedor', event.target.value)} placeholder="Código proveedor" className="rounded-lg p-2 text-sm dark:bg-slate-900 dark:text-white" />
              {items.length > 1 && <button type="button" onClick={() => setItems(prev => prev.filter((_, actual) => actual !== indice))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 p-2 text-xs font-black text-red-500"><X size={14} /> Quitar item</button>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setItems(prev => [...prev, itemVacio()])} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-black uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300"><Plus size={14} /> Agregar item</button><button type="submit" disabled={guardando} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"><Save size={14} /> {guardando ? 'Guardando...' : 'Guardar compra'}</button></div>
        </form>
      )}

      {cargando ? <div className="py-12 text-center text-xs font-black uppercase text-slate-400"><RefreshCw className="mx-auto mb-2 animate-spin" /> Cargando compras...</div> : compras.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700">Todavía no hay compras registradas.</div> : (
        <div className="space-y-3">{compras.map(compra => <article key={compra.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black uppercase dark:text-white">Compra #{compra.id} · {compra.proveedor}</h3><p className="text-xs text-slate-500">{compra.estado} · {compra.items.length} item(s) · {compra.total_productos_usdt} USDT</p></div><span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase text-amber-600">{compra.fecha_compra || 'Sin fecha'}</span></div><div className="mt-3 space-y-2">{compra.items.map(item => { const pendiente = Number(item.cantidad_comprada) - Number(item.cantidad_recibida); return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60"><div><p className="text-sm font-black dark:text-white">{item.titulo} · {item.artista}</p><p className="text-[10px] uppercase text-slate-500">Compradas: {item.cantidad_comprada} · Recibidas: {item.cantidad_recibida} · {item.estado}</p></div>{pendiente > 0 && <button type="button" onClick={() => void prepararRecepcion(item)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase text-white"><PackageCheck size={14} /> Agregar al inventario</button>}</div>; })}</div></article>)}</div>
      )}
    </section>
  );
}
