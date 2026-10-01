import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { 
  Settings, Plus, Upload, Book, List, 
  Edit2, Save, X, Trash2, ShoppingBag, CheckCircle, 
  Hash, MessageCircle, Layers, Disc, Star, Search, Ticket, Music, ShieldCheck, LogOut, AlertTriangle, Power, RotateCcw
} from 'lucide-react';

// Componentes administrativos externos
import { VinylForm } from './admin/VinylForm';
import { BulkImporter } from './admin/BulkImporter';
import { CurrencyManager } from './admin/CurrencyManager';
import { ViniloCatalogo, Cupon, CalidadVinilo, TipoCupon } from '../types/database';
import { apiUrl } from '../lib/api';
// Los DECIMAL (`total_pago`, `descuento_aplicado`, `cupones.valor`) llegan como
// string desde mysql2: `importeUsd` es el helper que ya usan "mis pedidos", el
// catálogo y los favoritos, así que el panel no inventa otro formato.
import { importeUsd } from '../lib/cuenta';

type Tab = 'list' | 'form' | 'bulk' | 'currency' | 'manual' | 'orders' | 'coupons';

interface AdminPanelProps {
  onBack: () => void;
}

// Refleja la fila que devuelve GET /api/pedidos (tabla `pedidos`).
interface PedidoItem {
  id?: number;
  id_vinilo?: number;
  vinilo?: { id?: number };
  cantidad?: number;
  qty?: number;
}

interface PedidoApi {
  id_pedido: number;
  numero_orden: string | null;
  fecha: string;
  nombre_cliente: string | null;
  whatsapp_cliente: string | null;
  // `total_pago` es DECIMAL y mysql2 devuelve los DECIMAL como STRING ("45.00"),
  // no como number: por eso el tipo lo declara number|string. Sin el Number()
  // el panel pintaba el string crudo y se veía `$45.00` en vez de `USD 45.00`
  // (y con miles, `$1234.0000`).
  total_pago: number | string | null;
  items: PedidoItem[] | string | null;
  estado: string;
  // GET /api/pedidos hace SELECT *, asi que con la migracion 2026-09-29 llegan
  // tambien las columnas del cupon y la del cliente que empezo sesion. Opcionales
  // a proposito: contra una base sin migrar esas columnas no existen y llegan
  // `undefined`, y declararlas obligatorias esconde justo ese caso.
  cupon_codigo?: string | null;
  descuento_aplicado?: number | string | null;
  usuario_id?: number | null;
}

const ETIQUETAS_ESTADO_PEDIDO: Record<string, string> = {
  pendiente: 'Pendiente',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const etiquetaEstadoPedido = (estado: string) => ETIQUETAS_ESTADO_PEDIDO[estado] || estado;

// El listado de cupones se tipa con `Cupon` directo (database.ts). Antes había
// un `CuponAdmin` local que le sumaba `creado_en` al tipo base porque
// `database.ts` todavía no lo tenía; dejó de hacer falta cuando el tipo base
// quedó alineado con la migración 2026-09-28 (el listado trae `creado_en`).

// El `error` del server se muestra tal cual (diseño de todas las rutas de
// admin): se lee del cuerpo sin castear a `any`.
function mensajeDeError(cuerpo: unknown, porDefecto: string): string {
  if (typeof cuerpo === 'object' && cuerpo !== null) {
    const { error } = cuerpo as { error?: unknown };
    if (typeof error === 'string' && error) return error;
  }
  return porDefecto;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [vinilos, setVinilos] = useState<ViniloCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState<Partial<ViniloCatalogo>>({});
  const [subiendo, setSubiendo] = useState(false);
  const [busquedaInv, setBusquedaInv] = useState('');
  const [sessionError, setSessionError] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const getApiUrl = useCallback(() => apiUrl(), []);

  // --- LÓGICA DE SESIÓN Y SEGURIDAD ---
  // La sesión vive en una cookie httpOnly: acá no hay token que guardar.
  const cerrarSesionTotal = useCallback(async () => {
    try {
      await fetch(`${getApiUrl()}/api/admin/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) { console.error("Error al notificar logout:", err); }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    onBack();
  }, [getApiUrl, onBack]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      alert("Sesión finalizada por inactividad (15 min)");
      cerrarSesionTotal();
    }, 15 * 60 * 1000);
  }, [cerrarSesionTotal]);

  useEffect(() => {
    // Si la cookie ya no es válida (expiró, se cerró en otro lado), se vuelve al login.
    fetch(`${getApiUrl()}/api/admin/yo`, { credentials: 'include' }).then(res => {
      if (!res.ok) onBack();
    }).catch(() => onBack());

    const sendHeartbeat = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/admin/heartbeat`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          setSessionError(true);
          cerrarSesionTotal();
        }
      } catch {
        console.error("Error latido - reintentando en el próximo ciclo");
        // No cerramos sesión por un error de red puntual
      }
    };

    sendHeartbeat();
    heartbeatInterval.current = setInterval(sendHeartbeat, 15000); // 15s en lugar de 10s

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const resetTimerWrapper = () => resetTimer();
    events.forEach(event => window.addEventListener(event, resetTimerWrapper));
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      events.forEach(event => window.removeEventListener(event, resetTimerWrapper));
    };
  }, [getApiUrl, cerrarSesionTotal, resetTimer, onBack]);



  // --- API Y DATOS ---
  const cargarVinilos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/vinilos`, { credentials: 'include' });
      const data = await res.json();
      setVinilos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (!sessionError) cargarVinilos(); 
  }, [sessionError]);

  const vinilosFiltrados = vinilos.filter(v => 
  v.titulo?.toLowerCase().includes(busquedaInv.toLowerCase()) ||
  v.artista?.toLowerCase().includes(busquedaInv.toLowerCase()) ||
  v.codigo?.toLowerCase().includes(busquedaInv.toLowerCase())
);

  // --- MANEJO DE IMÁGENES ---
  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    Array.from(files).forEach(file => { formData.append('imagenes', file); });

    try {
      setSubiendo(true);
      const res = await fetch(`${getApiUrl()}/api/upload-multiple`, { method: 'POST', body: formData, credentials: 'include' });
      if (!res.ok) throw new Error("Error en la subida");
      const data = await res.json(); 
      const nuevasFotos = Array.isArray(data.urls) ? data.urls : [];
      const fotosActuales = formEdit.imagen_url ? formEdit.imagen_url.split(',') : [];
      const mixFinal = [...fotosActuales, ...nuevasFotos].filter(url => url !== '').join(',');
      setFormEdit(prev => ({ ...prev, imagen_url: mixFinal }));
      alert(`✅ ${nuevasFotos.length} imágenes añadidas`);
    } catch { alert("❌ Error al subir imagen"); } 
    finally { setSubiendo(false); }
  };

  const hacerPrincipal = (index: number) => {
    const fotos = formEdit.imagen_url ? formEdit.imagen_url.split(',') : [];
    const nuevas = [...fotos];
    const [fotoSeleccionada] = nuevas.splice(index, 1);
    nuevas.unshift(fotoSeleccionada);
    setFormEdit({ ...formEdit, imagen_url: nuevas.join(',') });
  };

  const eliminarFoto = (index: number) => {
    const fotos = formEdit.imagen_url ? formEdit.imagen_url.split(',') : [];
    const nuevas = fotos.filter((_, i) => i !== index);
    setFormEdit({ ...formEdit, imagen_url: nuevas.join(',') });
  };

  const handleSave = async (id: string) => {
    try {
      const payload = { 
        ...formEdit,
        precio_venta: Number(formEdit.precio_venta || 0),
        stock_actual: Number(formEdit.stock_actual || 0)
      };
      const res = await fetch(`${getApiUrl()}/api/vinilos/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // El PUT manda el precio como número, pero lo que queda en la lista es
        // una fila de la base y `precio_venta` es DECIMAL: vuelve como string.
        // Sin el String() el tipo mintiría y el próximo que lo formatee sin
        // Number() lo descubre en producción.
        const guardado = { ...formEdit, precio_venta: String(payload.precio_venta), stock_actual: payload.stock_actual };
        setVinilos(vinilos.map(v => v.id === id ? { ...v, ...guardado } : v));
        setEditandoId(null);
        alert("✅ Cambios guardados");
      }
    } catch { alert("❌ Error de conexión"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vinilo?")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/vinilos/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) setVinilos(vinilos.filter(v => v.id !== id));
    } catch { alert("❌ Error al eliminar"); }
  };

  const renderImage = (url: string | undefined) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${getApiUrl()}${url}`;
  };

  if (sessionError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md bg-white dark:bg-slate-900 p-8 rounded-3xl border border-red-200 dark:border-red-900/30 text-center shadow-2xl">
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-2">Acceso Restringido</h2>
          <p className="text-slate-500 text-sm mb-6">Ya hay una sesión activa o tu token ha expirado.</p>
          <button onClick={cerrarSesionTotal} className="w-full bg-slate-900 dark:bg-white dark:text-slate-950 text-white py-3 rounded-xl font-black text-xs uppercase">
            REINTENTAR ACCESO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-40 border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg sm:text-xl font-black dark:text-white uppercase">Admin Panel</h1>
          </div>
          <button onClick={cerrarSesionTotal} className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-950 text-white rounded-lg font-black text-xs uppercase hover:opacity-90 transition-all"><LogOut size={16}/> SALIR</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-4 mb-4 sm:mb-8">
          <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List />} title="Inventario" sub="Gestión" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag />} title="Pedidos" sub="Ventas" />
          <TabButton active={activeTab === 'coupons'} onClick={() => setActiveTab('coupons')} icon={<Ticket />} title="Cupones" sub="Promos" />
          <TabButton active={activeTab === 'form'} onClick={() => setActiveTab('form')} icon={<Plus />} title="Nuevo" sub="Carga" />
          <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} icon={<Upload />} title="Importar" sub="CSV" />
          <TabButton active={activeTab === 'currency'} onClick={() => setActiveTab('currency')} icon={<Settings />} title="Tasas" sub="Dólar/ARS" />
          <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} icon={<Book />} title="Manual" sub="Ayuda" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-3 sm:p-6">
          {activeTab === 'list' && (
            <div className="space-y-6">
              <div className="relative w-full md:w-1/3">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar en inventario..."
                  value={busquedaInv}
                  onChange={(e) => setBusquedaInv(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-sm font-medium"
                />
              </div>

              <div className="space-y-3 md:hidden">
                {loading ? (
                  <div className="text-center py-16 opacity-50"><Disc className="animate-spin mx-auto mb-2 text-amber-500" /> CARGANDO...</div>
                ) : vinilosFiltrados.length > 0 ? (
                  vinilosFiltrados.map((v) => editandoId === v.id ? (
                    <div key={v.id} className="rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-black uppercase tracking-wider dark:text-white">Editar vinilo</h3>
                        <button type="button" onClick={() => setEditandoId(null)} className="p-2 rounded-xl bg-slate-300 dark:bg-slate-700"><X size={16} /></button>
                      </div>
                      <input aria-label="Título" className="w-full rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" placeholder="Título" value={formEdit.titulo || ''} onChange={e => setFormEdit({ ...formEdit, titulo: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <input aria-label="Artista" className="w-full rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" placeholder="Artista" value={formEdit.artista || ''} onChange={e => setFormEdit({ ...formEdit, artista: e.target.value })} />
                        <input aria-label="Código SKU" className="w-full rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" placeholder="SKU" value={formEdit.codigo || ''} onChange={e => setFormEdit({ ...formEdit, codigo: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input aria-label="Precio USD" type="number" step="0.01" className="w-full rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" placeholder="USD" value={formEdit.precio_venta ?? ''} onChange={e => setFormEdit({ ...formEdit, precio_venta: e.target.value })} />
                        <input aria-label="Stock" type="number" className="w-full rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" placeholder="Stock" value={formEdit.stock_actual || 0} onChange={e => setFormEdit({ ...formEdit, stock_actual: Number(e.target.value) })} />
                        <select aria-label="Calidad" className="w-full rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" value={formEdit.calidad || ''} onChange={e => setFormEdit({ ...formEdit, calidad: e.target.value as CalidadVinilo })}>
                          {['M', 'NM', 'EX', 'VG+', 'VG', 'G'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={() => handleSave(v.id)} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2"><Save size={16} /> GUARDAR CAMBIOS</button>
                    </div>
                  ) : (
                    <div key={v.id} className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-3">
                      <div className="flex gap-3">
                        <img src={renderImage(v.imagen_url?.split(',')[0])} className="w-20 h-20 rounded-xl object-cover shrink-0 bg-slate-200 dark:bg-slate-900" alt={v.titulo} />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold dark:text-white uppercase tracking-tight truncate">{v.titulo}</div>
                          <div className="text-xs text-slate-500 truncate">{v.artista}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {v.codigo && <span className="text-[9px] px-1.5 py-1 rounded bg-slate-200 dark:bg-slate-900 text-slate-500 font-black">#{v.codigo}</span>}
                            {v.calidad && <span className="text-[9px] px-1.5 py-1 rounded bg-amber-500/10 text-amber-600 font-black">{v.calidad}</span>}
                            {v.genero && <span className="text-[9px] px-1.5 py-1 rounded bg-slate-200 dark:bg-slate-900 text-slate-500 font-black">{v.genero}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-amber-500 font-black font-mono">USD {Number(v.precio_venta).toLocaleString()}</div>
                          <div className={`text-[10px] font-black uppercase ${v.stock_actual > 0 ? 'text-slate-400' : 'text-red-500'}`}>{v.stock_actual} en stock</div>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setEditandoId(v.id)} className="p-3 rounded-xl bg-amber-500/10 text-amber-600" aria-label="Editar vinilo"><Edit2 size={18} /></button>
                          <button type="button" onClick={() => handleDelete(v.id)} className="p-3 rounded-xl bg-red-500/10 text-red-500" aria-label="Eliminar vinilo"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : <div className="text-center py-16 text-slate-400 uppercase text-[10px] font-black">No hay resultados</div>}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-slate-400 text-[10px] uppercase tracking-widest font-black">
                      <th className="pb-4 px-2">Producto / Galería</th>
                      <th className="pb-4 px-2 text-center">Precio/Stock/Calidad</th>
                      <th className="pb-4 px-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={3} className="text-center py-20 opacity-50"><Disc className="animate-spin mx-auto mb-2 text-amber-500" /> CARGANDO...</td></tr>
                    ) : vinilosFiltrados.length > 0 ? (
                      vinilosFiltrados.map((v) => (
                        <tr key={v.id} className="bg-white dark:bg-slate-800/40 border-y dark:border-slate-800 group align-top">
                          {editandoId === v.id ? (
                            <td colSpan={3} className="p-6 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Título</label>
                                    <input className="w-full font-bold border-none rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" value={formEdit.titulo || ''} onChange={e => setFormEdit({...formEdit, titulo: e.target.value})} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Artista</label>
                                      <input className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" value={formEdit.artista || ''} onChange={e => setFormEdit({...formEdit, artista: e.target.value})} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Género</label>
                                  <input className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" value={formEdit.genero || ''} onChange={e => setFormEdit({...formEdit, genero: e.target.value})} placeholder="Ej: Rock" />
                                  </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Código (SKU)</label>
                                  <input className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" value={formEdit.codigo || ''} onChange={e => setFormEdit({...formEdit, codigo: e.target.value})} placeholder="LP-001" />
                                  </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">País de origen</label>
                                  <input className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" value={formEdit.pais_origen || ''} onChange={e => setFormEdit({...formEdit, pais_origen: e.target.value})} placeholder="Ej: UK, USA, ARG" />
                                  </div>
                                </div>
                                  <div className="flex gap-4">
                                    <div className="flex-1">
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Precio USD</label>
                                      {/* El input guarda el texto tal cual (como el resto del
                                          formulario): `precio_venta` es DECIMAL y llega como
                                          string, y al mandar el PUT se convierte con Number()
                                          en handleSave. */}
                                      <input type="number" step="0.01" className="w-full border-none rounded-xl p-3 dark:bg-slate-900 text-sm font-bold" value={formEdit.precio_venta ?? ''} onChange={e => setFormEdit({...formEdit, precio_venta: e.target.value})} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Stock</label>
                                      <input type="number" className="w-full border-none rounded-xl p-3 dark:bg-slate-900 text-sm font-bold" value={formEdit.stock_actual || 0} onChange={e => setFormEdit({...formEdit, stock_actual: Number(e.target.value)})} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Calidad</label>
                                      <select className="w-full border-none rounded-xl p-3 dark:bg-slate-900 text-sm font-bold text-amber-500" value={formEdit.calidad || ''} onChange={e => setFormEdit({...formEdit, calidad: e.target.value as CalidadVinilo})}>
                                        {['M','NM','EX','VG+','VG','G'].map(c => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-4">
                                    <button onClick={() => handleSave(v.id)} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"><Save size={16}/> GUARDAR</button>
                                    <button onClick={() => setEditandoId(null)} className="px-4 bg-slate-300 dark:bg-slate-700 rounded-xl text-xs font-black"><X size={16}/></button>
                                  </div>
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                  <label className="text-[10px] font-black uppercase text-slate-500 block">Galería</label>
                                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                    {formEdit.imagen_url?.split(',').filter(u => u !== '').map((url, idx) => (
                                      <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${idx === 0 ? 'border-amber-500' : 'border-transparent'}`}>
                                        <img src={renderImage(url)} className="w-full h-full object-cover" alt="Preview" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center gap-2">
                                          {idx !== 0 && <button onClick={() => hacerPrincipal(idx)} className="p-1.5 bg-amber-500 text-slate-950 rounded-lg"><Star size={14}/></button>}
                                          <button onClick={() => eliminarFoto(idx)} className="p-1.5 bg-red-500 text-white rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                      </div>
                                    ))}
                                    <label className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${subiendo ? 'border-amber-500 bg-amber-500/10 cursor-wait' : 'border-slate-300 dark:border-slate-700 cursor-pointer text-slate-400 hover:text-amber-500'}`}>
                                      {subiendo ? <Disc className="animate-spin text-amber-500" size={24} /> : <><Plus size={24} /><input type="file" className="hidden" multiple onChange={handleMultipleFileUpload} disabled={subiendo} /></>}
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-4 px-2">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img src={renderImage(v.imagen_url?.split(',')[0])} className="w-14 h-14 rounded-xl object-cover shadow-md" alt={v.titulo} />
                                    {v.imagen_url && v.imagen_url.split(',').length > 1 && (
                                      <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900"><Layers size={10} /></span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold dark:text-white uppercase tracking-tighter italic">{v.titulo}</div>
                                    <div className="text-xs text-slate-500 font-medium mb-1">{v.artista}</div>
                                    <div className="flex gap-2 flex-wrap">
                                    {v.codigo && <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded flex items-center gap-1 font-black uppercase"><Hash size={8}/> {v.codigo}</span>}
                                    {v.pais_origen && <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded flex items-center gap-1 font-black uppercase"><Disc size={8}/> {v.pais_origen}</span>}
                                    {v.genero && <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded flex items-center gap-1 font-black uppercase"><Music size={8}/> {v.genero}</span>}
                                    {v.calidad && <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded flex items-center gap-1 font-black uppercase"><ShieldCheck size={8}/> {v.calidad}</span>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="text-amber-500 font-black text-lg font-mono">${Number(v.precio_venta).toLocaleString()}</div>
                                <div className={`text-[10px] font-black uppercase ${v.stock_actual > 0 ? 'text-slate-400' : 'text-red-500'}`}>{v.stock_actual} EN STOCK</div>
                              </td>
                              <td className="text-right px-2">
                                <div className="flex justify-end gap-1 items-center">
                                  <button
                                    onClick={async () => {
                                     const nuevoValor = v.destacado ? 0 : 1;
                                    await fetch(`${getApiUrl()}/api/vinilos/${v.id}/destacado`, {
                                    method: 'PUT',
                                     credentials: 'include',
                                     headers: { 'Content-Type': 'application/json' },
                                     body: JSON.stringify({ destacado: nuevoValor })
                                    });
                                    setVinilos(vinilos.map(item => 
                                    item.id === v.id ? { ...item, destacado: nuevoValor } : item
                                 ));
                               }}
                                className={`p-2 transition-colors ${v.destacado ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                                title={v.destacado ? 'Quitar destacado' : 'Marcar como destacado'}
  >
                              <Star size={20} fill={v.destacado ? 'currentColor' : 'none'} />
                                </button>
                                <button onClick={() => { setEditandoId(v.id); setFormEdit(v); }} className="p-2 text-slate-400 hover:text-amber-500"><Edit2 size={20}/></button>
                                <button onClick={() => handleDelete(v.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={20}/></button>
                              </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} className="text-center py-20 text-slate-400 uppercase text-[10px] font-black">No hay resultados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && <OrdersList getApiUrl={getApiUrl} onOrderUpdate={cargarVinilos} setSessionError={setSessionError} />}
          {activeTab === 'coupons' && <CouponManager getApiUrl={getApiUrl} />}
          {activeTab === 'form' && <VinylForm onSuccess={cargarVinilos} />}
          {activeTab === 'bulk' && <BulkImporter />}
          {activeTab === 'currency' && <CurrencyManager getApiUrl={getApiUrl} />}
          {activeTab === 'manual' && <UserManual />}
        </div>
      </main>
    </div>
  );
}

// --- SUBCOMPONENTES ---

// Banner de error del panel. Estaba duplicado cuatro veces (alta/listado de
// cupones, acciones sobre un cupón y los dos errores de la lista de pedidos) y
// los resultados salían distintos según de dónde venían. Un solo marcado para
// los cuatro: mismo `role="alert"`, mismos colores, y un botón de reintentar
// donde tiene sentido (los que son un fallo de lectura, no de la acción).
function BannerAviso({ texto, onCerrar, onReintentar }: {
  texto: string;
  onCerrar: () => void;
  onReintentar?: () => void;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-4 rounded-2xl">
      <AlertTriangle size={18} className="text-red-500 shrink-0" />
      <span className="flex-grow text-sm font-bold uppercase tracking-tight text-red-500">{texto}</span>
      <button
        type="button"
        onClick={onReintentar ?? onCerrar}
        aria-label={onReintentar ? 'Reintentar' : 'Cerrar aviso'}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        {onReintentar ? <RotateCcw size={16} /> : <X size={16} />}
      </button>
    </div>
  );
}

function TabButton({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; sub: string }) {
  return (
    <button onClick={onClick} className={`p-2 sm:p-4 rounded-2xl border-2 text-left transition-all ${active ? 'border-slate-900 dark:border-amber-500 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-amber-500/50'}`}>
      <div className={`mb-1 sm:mb-2 p-1.5 sm:p-2 rounded-lg inline-block [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5 ${active ? 'bg-slate-800 dark:bg-amber-600/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{icon}</div>
      <p className="font-bold text-[11px] sm:text-xs">{title}</p>
      <p className="text-[10px] uppercase opacity-60 tracking-tighter">{sub}</p>
    </button>
  );
}

// Fechas de cupones: se formatea el string que manda MySQL, SIN pasar por
// `new Date('YYYY-MM-DD')`. Eso se parsea como UTC midnight, asi que en
// Argentina (UTC-3) `toLocaleDateString()` mostraba un dia antes del real.
// MySQL puede mandar 'YYYY-MM-DD' o el ISO de JSON.stringify, asi que se saca
// la parte de fecha del texto tal cual venga.
function fechaIso(valor: string | Date | null | undefined): string {
  if (!valor) return '';
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(texto);
  return match ? match[1] : '';
}

/** '2026-09-28' -> '28/09/2026' (o '' si no se puede leer). */
function formatearFechaCorta(valor: string | Date | null | undefined): string {
  const iso = fechaIso(valor);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

/** '2026-09-28 15:04:00' -> '28/09/2026 15:04' (o '' si no se puede leer). */
function formatearFechaHora(valor: string | Date | null | undefined): string {
  const texto = valor instanceof Date ? valor.toISOString() : String(valor ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(texto);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : '';
}

// Estado del formulario de edicion. Es un objeto de strings (igual que el de
// alta) para no pelearse con los inputs: se convierte a numero recien al
// mandar el PUT.
interface FormCupon {
  codigo: string;
  tipo: TipoCupon;
  valor: string;
  fecha_expiracion: string;
  uso_maximo: string;
  usos_actuales: string;
  activo: string;
}

const FORM_CUPON_VACIO: FormCupon = {
  codigo: '',
  tipo: 'porcentaje',
  valor: '',
  fecha_expiracion: '',
  uso_maximo: '',
  usos_actuales: '',
  activo: '1'
};

function CouponManager({ getApiUrl }: { getApiUrl: () => string }) {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [nuevo, setNuevo] = useState({ codigo: '', tipo: 'porcentaje', valor: '', fecha_expiracion: '', uso_maximo: '' });
  // id del cupón con una operación en curso, para deshabilitar sus dos botones.
  const [ocupado, setOcupado] = useState<number | null>(null);
  // Cupón abierto en el modal de edición.
  const [editando, setEditando] = useState<Cupon | null>(null);
  const [formEdicion, setFormEdicion] = useState<FormCupon>(FORM_CUPON_VACIO);
  const [errorEdicion, setErrorEdicion] = useState('');
  // El listado se recarga después de cada acción. Antes el fallo se iba al
  // console y la tabla quedaba vacía, que es indistinguible de "no tenés
  // cupones": un 401 por sesión vencida se veía como un panel sin datos.
  const [errorListado, setErrorListado] = useState('');
  // La primera carga no mostraba nada: la tabla salía vacía y a los 200 ms
  // aparecían las filas. Con `cargando` se distingue "todavía no sé" de
  // "no tenés cupones".
  const [cargando, setCargando] = useState(true);
  // Fallo de la última acción sobre un cupón (crear, resetear, activar o
  // borrar). Antes cada una de las cuatro tenía su propio alert() nativo, que en
  // una tabla de administración se veía como otra aplicación.
  const [errorAccion, setErrorAccion] = useState('');
  // Confirmación en línea de las dos acciones destructivas. Se hace en la misma
  // fila, con un "¿Sí?" y un "No": el panel ya pedía confirmación (con
  // confirm()), pero un modal del navegador encima de la tabla tapa el contexto
  // de lo que se está por borrar.
  const [porConfirmar, setPorConfirmar] = useState<{ id: number; accion: 'resetear' | 'borrar' } | null>(null);

  const fetchCupones = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones`, { credentials: 'include' });
      if (!res.ok) {
        setErrorListado(mensajeDeError(await res.json().catch(() => null), `el servidor respondió ${res.status}`));
        return;
      }
      const data: unknown = await res.json();
      setCupones(Array.isArray(data) ? (data as Cupon[]) : []);
      setErrorListado('');
    } catch {
      setErrorListado('No se pudieron cargar los cupones: error de conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { fetchCupones(); }, []);

  // --- Estado "real" del cupón ---
  // activo = 1 no alcanza para decir que sirve: la fecha y el contador de usos
  // manda igual. El backend usa CURDATE() (fecha del servidor); acá se usa la
  // fecha local, que es la que ve el admin. Los dos cortes son strings
  // YYYY-MM-DD, así que compararlos como texto ordena por fecha.
  const hoy = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const fechaCorta = (c: Cupon) => fechaIso(c.fecha_expiracion);
  const estaVencido = (c: Cupon) => !!fechaCorta(c) && fechaCorta(c) < hoy;
  const estaAgotado = (c: Cupon) => c.uso_maximo !== null && Number(c.usos_actuales || 0) >= Number(c.uso_maximo);

  const crearCupon = async () => {
    if (!nuevo.codigo || !nuevo.valor) {
      setErrorAccion('Completá el código y el valor del cupón.');
      return;
    }
    setErrorAccion('');
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo)
      });
      if (res.ok) {
        // Sin mensaje de éxito: la fila nueva aparece en la tabla, que es la
        // confirmación. Un toast acá taparía justo lo que se quiere ver.
        setNuevo({ codigo: '', tipo: 'porcentaje', valor: '', fecha_expiracion: '', uso_maximo: '' });
        await fetchCupones();
      } else {
        // El server valida (código repetido, porcentaje > 100, fecha inválida...)
        // y devuelve el motivo: se muestra tal cual, no un "error" genérico.
        const data: unknown = await res.json().catch(() => null);
        setErrorAccion(mensajeDeError(data, 'No se pudo crear el cupón'));
      }
    } catch { setErrorAccion('No se pudo crear el cupón: error de conexión con el servidor.'); }
  };

  // --- EDICIÓN ---
  // Antes no había forma de corregir un `valor` mal cargado sin borrar y
  // recrear el cupón (y eso perdía `usos_actuales`). El PUT es parcial: se
  // mandan solo los campos del formulario.
  const abrirEdicion = (c: Cupon) => {
    setEditando(c);
    setErrorEdicion('');
    setFormEdicion({
      codigo: c.codigo,
      tipo: c.tipo,
      valor: String(c.valor),
      // Los <input type="date"> quieren YYYY-MM-DD, no el ISO de MySQL.
      fecha_expiracion: fechaIso(c.fecha_expiracion),
      uso_maximo: c.uso_maximo === null || c.uso_maximo === undefined ? '' : String(c.uso_maximo),
      usos_actuales: String(c.usos_actuales ?? 0),
      activo: c.activo ? '1' : '0'
    });
  };

  const cerrarEdicion = () => {
    setEditando(null);
    setErrorEdicion('');
  };

  const guardarEdicion = async () => {
    if (!editando) return;
    const valor = Number(formEdicion.valor);
    const usoMaximo = formEdicion.uso_maximo === '' ? null : Number(formEdicion.uso_maximo);
    const usosActuales = Number(formEdicion.usos_actuales || 0);

    // Mismas reglas que server.js validarCupon(): se chequean acá para no
    // gastar un request en algo que ya se sabe, y para poder señalar el campo.
    if (!formEdicion.codigo.trim()) return setErrorEdicion('El código del cupón no puede estar vacío');
    if (!Number.isFinite(valor) || valor <= 0) return setErrorEdicion('El valor tiene que ser un número mayor a 0');
    if (formEdicion.tipo === 'porcentaje' && valor > 100) return setErrorEdicion('Un cupón de porcentaje no puede ser mayor a 100');
    if (usoMaximo !== null && (!Number.isInteger(usoMaximo) || usoMaximo < 1)) {
      return setErrorEdicion('El uso máximo tiene que ser un entero mayor o igual a 1');
    }
    if (usoMaximo !== null && (!Number.isInteger(usosActuales) || usosActuales < 0)) {
      return setErrorEdicion('Los usos actuales tienen que ser un entero mayor o igual a 0');
    }

    const cuerpo: Record<string, unknown> = {
      codigo: formEdicion.codigo.trim().toUpperCase(),
      tipo: formEdicion.tipo,
      valor,
      // El <input type="date"> vacío es '' y el server lo traduce a NULL = sin
      // límite (server.js:628), así que acá va el string tal cual.
      fecha_expiracion: formEdicion.fecha_expiracion,
      // `usoMaximo` ya sale validado (entero >= 1, o null) y null es justamente
      // el "sin límite" del server: se manda el número y no el texto del input,
      // para que el contrato no dependa de un parseo del otro lado.
      uso_maximo: usoMaximo,
      activo: formEdicion.activo === '1' ? 1 : 0
    };
    // Sin `uso_maximo` el contador no significa nada (la fila nunca se agota y el
    // server no lo valida), así que no se manda y el input queda deshabilitado.
    if (usoMaximo !== null) cuerpo.usos_actuales = usosActuales;

    setOcupado(editando.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones/${editando.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok) {
        // 409 = el código nuevo ya lo tiene otro cupón; 400 = usos_actuales
        // mayor que uso_maximo. Los dos los dice el server con su propio texto.
        cerrarEdicion();
        await fetchCupones();
      } else {
        setErrorEdicion(mensajeDeError(data, 'No se pudo guardar el cupón'));
      }
    } catch { setErrorEdicion('Error de conexión'); }
    finally { setOcupado(null); }
  };

  // Resetear usos: un cupón agotado vuelve a servir sin tocar código ni valor.
  // La confirmación la pide `porConfirmar` (el botón de la fila), no un
  // confirm(): ver la fila que se está por tocar importa más que el modal del
  // navegador.
  const resetearUsos = async (c: Cupon) => {
    setPorConfirmar(null);
    setErrorAccion('');
    setOcupado(c.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones/${c.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usos_actuales: 0 })
      });
      if (res.ok) {
        await fetchCupones();
      } else {
        const data: unknown = await res.json().catch(() => null);
        setErrorAccion(`No se pudo resetear el contador de ${c.codigo}: ${mensajeDeError(data, 'el servidor no dio un motivo')}`);
      }
    } catch { setErrorAccion('No se pudo resetear el contador: error de conexión con el servidor.'); }
    finally { setOcupado(null); }
  };

  // Activa/desactiva sin pisar el resto: PUT parcial con { activo }.
  const toggleActivo = async (c: Cupon) => {
    setPorConfirmar(null);
    setErrorAccion('');
    setOcupado(c.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones/${c.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: c.activo ? 0 : 1 })
      });
      if (res.ok) {
        await fetchCupones();
      } else {
        const data: unknown = await res.json().catch(() => null);
        setErrorAccion(`No se pudo cambiar el estado de ${c.codigo}: ${mensajeDeError(data, 'el servidor no dio un motivo')}`);
      }
    } catch { setErrorAccion('No se pudo cambiar el estado: error de conexión con el servidor.'); }
    finally { setOcupado(null); }
  };

  const borrarCupon = async (c: Cupon) => {
    setPorConfirmar(null);
    setErrorAccion('');
    setOcupado(c.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones/${c.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await fetchCupones();
      } else {
        const data: unknown = await res.json().catch(() => null);
        setErrorAccion(`No se pudo borrar ${c.codigo}: ${mensajeDeError(data, 'el servidor no dio un motivo')}`);
      }
    } catch { setErrorAccion('No se pudo borrar el cupón: error de conexión con el servidor.'); }
    finally { setOcupado(null); }
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-800">
        <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-amber-500">Crear Nuevo Cupón</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input placeholder="CÓDIGO" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none uppercase font-bold" value={nuevo.codigo} onChange={e => setNuevo({...nuevo, codigo: e.target.value})} />
          <select className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none" value={nuevo.tipo} onChange={e => setNuevo({...nuevo, tipo: e.target.value})}>
            <option value="porcentaje">% Porcentaje</option>
            <option value="fijo">Monto Fijo (USD)</option>
          </select>
          <input type="number" placeholder="Valor" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none" value={nuevo.valor} onChange={e => setNuevo({...nuevo, valor: e.target.value})} />
          <input type="date" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none text-slate-400" value={nuevo.fecha_expiracion} onChange={e => setNuevo({...nuevo, fecha_expiracion: e.target.value})} />
          {/* Vacío = sin límite de usos. Es lo que habilita el estado AGOTADO en la tabla. */}
          <input type="number" min="1" placeholder="Usos máx. (opcional)" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none" value={nuevo.uso_maximo} onChange={e => setNuevo({...nuevo, uso_maximo: e.target.value})} />
          <button onClick={crearCupon} className="bg-amber-500 text-slate-950 font-black rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2"><Plus size={18}/> CREAR</button>
        </div>
        {/* El alta no tiene campo `activo` a propósito: un cupón nuevo nace activo
            y se apaga desde la tabla si hace falta. */}
      </div>
      {errorListado && (
        <BannerAviso
          texto={`No se pudo leer el listado de cupones: ${errorListado}`}
          onCerrar={() => setErrorListado('')}
          onReintentar={() => { setErrorListado(''); void fetchCupones(); }}
        />
      )}
      {errorAccion && <BannerAviso texto={errorAccion} onCerrar={() => setErrorAccion('')} />}
      <div className="overflow-hidden rounded-2xl border dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr><th className="p-4">Código</th><th className="p-4">Beneficio</th><th className="p-4">Expiración</th><th className="p-4 text-center">Usos</th><th className="p-4 text-right">Estado</th><th className="p-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800">
            {cargando ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[10px] font-black uppercase tracking-widest opacity-50">Cargando cupones...</td>
              </tr>
            ) : cupones.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[10px] font-black uppercase tracking-widest opacity-50">Todavía no hay cupones</td>
              </tr>
            ) : cupones.map(c => (
              <tr key={c.id} className="dark:text-slate-300">
                <td className="p-4">
                  <div className="font-bold text-amber-500">{c.codigo}</div>
                  {c.creado_en && (
                    <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">creado {formatearFechaHora(c.creado_en)}</div>
                  )}
                </td>
                {/* `valor` también es DECIMAL: sin el Number() un 20% se veía
                    como "20.00%" y un fijo de 5 como "USD 5.00" con el mismo
                    formato pero sin saber qué significaba. */}
                <td className="p-4">{c.tipo === 'porcentaje' ? `${Number(c.valor)}%` : importeUsd(c.valor)}</td>
                <td className="p-4 text-xs">{c.fecha_expiracion ? formatearFechaCorta(c.fecha_expiracion) : '∞ Sin límite'}</td>
                <td className="p-4 text-center text-xs font-mono">{c.usos_actuales} / {c.uso_maximo || '∞'}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {estaVencido(c) && <span className="text-[9px] font-black px-2 py-1 rounded bg-red-500/10 text-red-500">VENCIDO</span>}
                    {estaAgotado(c) && <span className="text-[9px] font-black px-2 py-1 rounded bg-red-500/10 text-red-500">AGOTADO</span>}
                    <span className={`text-[9px] font-black px-2 py-1 rounded ${c.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{c.activo ? 'ACTIVO' : 'INACTIVO'}</span>
                  </div>
                </td>
                <td className="p-4">
                  {porConfirmar?.id === c.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 text-right leading-tight">
                        {porConfirmar.accion === 'borrar'
                          ? `¿Borrar ${c.codigo}? Los pedidos hechos no se tocan.`
                          : `¿Poner en cero los usos de ${c.codigo}?`}
                      </span>
                      <button
                        type="button"
                        onClick={() => porConfirmar.accion === 'borrar' ? void borrarCupon(c) : void resetearUsos(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[9px] font-black uppercase transition-colors"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setPorConfirmar(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEdicion(c)} title="Editar cupón" className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setPorConfirmar({ id: c.id, accion: 'resetear' })} disabled={ocupado === c.id || Number(c.usos_actuales || 0) === 0} title="Resetear el contador de usos" className="p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-950 transition-all disabled:opacity-30">
                        <RotateCcw size={14} />
                      </button>
                      <button onClick={() => void toggleActivo(c)} disabled={ocupado === c.id} title={c.activo ? 'Desactivar cupón' : 'Activar cupón'} className="p-2 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-950 transition-all disabled:opacity-30">
                        <Power size={14} />
                      </button>
                      <button onClick={() => setPorConfirmar({ id: c.id, accion: 'borrar' })} disabled={ocupado === c.id} title="Borrar cupón" className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <div
          className="fixed inset-0 z-[110] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Editar cupón ${editando.codigo}`}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Editar Cupón</h3>
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mt-1">#{editando.id} · PUT parcial: solo se tocan los campos del formulario</p>
              </div>
              <button onClick={cerrarEdicion} aria-label="Cerrar" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Código</label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none uppercase font-bold"
                  value={formEdicion.codigo}
                  onChange={e => setFormEdicion({ ...formEdicion, codigo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Tipo</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none font-bold"
                  value={formEdicion.tipo}
                  onChange={e => setFormEdicion({ ...formEdicion, tipo: e.target.value as TipoCupon })}
                >
                  <option value="porcentaje">% Porcentaje</option>
                  <option value="fijo">Monto Fijo (USD)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                  Valor {formEdicion.tipo === 'porcentaje' ? '(0 a 100 %)' : '(USD)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none font-bold"
                  value={formEdicion.valor}
                  onChange={e => setFormEdicion({ ...formEdicion, valor: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Expiración (vacío = sin límite)</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none text-slate-700 dark:text-slate-200"
                  value={formEdicion.fecha_expiracion}
                  onChange={e => setFormEdicion({ ...formEdicion, fecha_expiracion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Usos máx. (vacío = ilimitado)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none"
                  value={formEdicion.uso_maximo}
                  onChange={e => setFormEdicion({ ...formEdicion, uso_maximo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Usos actuales</label>
                <input
                  type="number"
                  min="0"
                  disabled={formEdicion.uso_maximo === ''}
                  title={formEdicion.uso_maximo === '' ? 'Sin límite de usos no hay contador que editar' : 'Ajustá el contador a mano (ej: dejarlo en 0 para reutilizar el cupón)'}
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                  value={formEdicion.usos_actuales}
                  onChange={e => setFormEdicion({ ...formEdicion, usos_actuales: e.target.value })}
                />
                {formEdicion.uso_maximo === '' && (
                  <p className="text-[9px] font-bold uppercase text-slate-400 mt-1">Sin usos máx. no hay contador</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Estado</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none font-bold"
                  value={formEdicion.activo}
                  onChange={e => setFormEdicion({ ...formEdicion, activo: e.target.value })}
                >
                  <option value="1">Activo</option>
                  <option value="0">Inactivo</option>
                </select>
              </div>
            </div>

            {errorEdicion && (
              <p role="alert" className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-xs font-bold">
                <AlertTriangle size={14} className="shrink-0 mt-px" />
                {errorEdicion}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={guardarEdicion}
                disabled={ocupado === editando.id}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                <Save size={16} /> Guardar cambios
              </button>
              <button
                onClick={cerrarEdicion}
                className="px-6 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 rounded-xl font-black text-xs uppercase transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ORDERS LIST CON CORRECCIÓN ---
function OrdersList({ getApiUrl, onOrderUpdate, setSessionError }: { getApiUrl: () => string, onOrderUpdate: () => void, setSessionError: (val: boolean) => void }) {
  const [orders, setOrders] = useState<PedidoApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'pending' | 'history'>('pending');
  // Errores de la última acción (cancelar/finalizar): se muestran en la lista
  // en vez de un alert(), para que el motivo (404/409 del server) quede a la vista.
  const [errorPedidos, setErrorPedidos] = useState('');
  // Pedido con una operación en curso: deshabilita sus botones para no
  // mandar dos veces el mismo PUT (el segundo respondería 409).
  const [ocupadoPedido, setOcupadoPedido] = useState<number | null>(null);
  // El loader tapaba el componente entero, así que cada vez que se cancelaba o
  // finalizaba un pedido la lista desaparecía y volvía a aparecer. Con `cargado`
  // solo se reemplaza todo en la primera carga; las recargas siguientes dejan
  // ver la lista vieja mientras llega la nueva.
  const [cargado, setCargado] = useState(false);
  const [errorListado, setErrorListado] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/pedidos`, { credentials: 'include' });
      // Un 200 con cuerpo que no es un arreglo (o un 401) tiene que quedar
      // dicho: si no, la lista vacía se lee como "no tenés pedidos".
      if (!res.ok) {
        setErrorListado(mensajeDeError(await res.json().catch(() => null), `el servidor respondió ${res.status}`));
        if (res.status === 401) setSessionError(true);
        return;
      }
      const data: unknown = await res.json();
      setOrders(Array.isArray(data) ? (data as PedidoApi[]) : []);
      setErrorListado('');
    } catch {
      setErrorListado('No se pudo cargar el listado de pedidos: error de conexión con el servidor.');
    } finally {
      setLoading(false);
      setCargado(true);
    }
  };
  useEffect(() => { fetchOrders(); }, []);

  const finalizarPedido = async (order: PedidoApi) => {
    if (!confirm("¿Finalizar?")) return;
    setOcupadoPedido(order.id_pedido);
    setErrorPedidos('');
    try {
      const res = await fetch(`${getApiUrl()}/api/pedidos/${order.id_pedido}/finalizar`, { method: 'PUT', credentials: 'include' });
      if (res.ok) {
        fetchOrders();
      } else if (res.status === 401) {
        setSessionError(true);
      } else {
        const cuerpo: unknown = await res.json().catch(() => null);
        setErrorPedidos(`Pedido #${order.numero_orden ?? order.id_pedido}: ${mensajeDeError(cuerpo, `el servidor respondió ${res.status}`)}`);
      }
    } catch { setErrorPedidos('No se pudo finalizar: error de conexión con el servidor.'); }
    finally { setOcupadoPedido(null); }
  };

  const cancelarPedido = async (order: PedidoApi) => {
    if (!confirm("¿Cancelar pedido? Se devolverá el stock al inventario.")) return;

    setOcupadoPedido(order.id_pedido);
    setErrorPedidos('');
    try {
      // SIN `items`: el server repone el stock desde el snapshot que se guardó
      // en la fila del pedido. Mandarlos desde acá era redundante y, si la
      // lista venía desactualizada, podía devolver stock equivocado.
      const res = await fetch(`${getApiUrl()}/api/pedidos/${order.id_pedido}/cancelar`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (res.ok) {
        onOrderUpdate();
        await fetchOrders();
      } else if (res.status === 401) {
        setSessionError(true); // Uso de setSessionError
      } else {
        // 404 = el pedido no existe; 409 = ya estaba cancelado o su estado es
        // terminal. El server lo explica y se muestra tal cual.
        const cuerpo: unknown = await res.json().catch(() => null);
        setErrorPedidos(`Pedido #${order.numero_orden ?? order.id_pedido}: ${mensajeDeError(cuerpo, `el servidor respondió ${res.status}`)}`);
      }
    } catch {
      setErrorPedidos('No se pudo cancelar: error de conexión con el servidor.');
    } finally {
      setOcupadoPedido(null);
    }
  };

  const currentOrders = filterTab === 'pending' ? orders.filter(o => o.estado === 'pendiente') : orders.filter(o => o.estado !== 'pendiente');

  if (loading && !cargado) return <div className="text-center py-10 text-[10px] opacity-50 font-black">CARGANDO...</div>;
  return (
    <div className="space-y-6">
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full max-w-md">
        <button onClick={() => setFilterTab('pending')} className={`flex-1 py-2 rounded-xl text-[10px] font-black ${filterTab === 'pending' ? 'bg-white dark:bg-slate-700 text-amber-500' : 'text-slate-500'}`}>PENDIENTES</button>
        <button onClick={() => setFilterTab('history')} className={`flex-1 py-2 rounded-xl text-[10px] font-black ${filterTab === 'history' ? 'bg-white dark:bg-slate-700 text-emerald-500' : 'text-slate-500'}`}>HISTORIAL</button>
      </div>
      {errorPedidos && <BannerAviso texto={errorPedidos} onCerrar={() => setErrorPedidos('')} />}
      {errorListado && (
        <BannerAviso
          texto={`No se pudo leer el listado de pedidos: ${errorListado}`}
          onCerrar={() => setErrorListado('')}
          onReintentar={() => { setErrorListado(''); void fetchOrders(); }}
        />
      )}
      <div className="grid gap-4">
        {currentOrders.length === 0 ? (
          <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest opacity-50">
            {orders.length === 0 ? 'Todavía no hay pedidos' : 'No hay pedidos en esta pestaña'}
          </p>
        ) : currentOrders.map(order => (
          <div key={order.id_pedido} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border dark:border-slate-800 flex justify-between items-center">
            <div>
              <p className="font-bold text-lg dark:text-white">{order.nombre_cliente}</p>
              <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-500 font-black uppercase">
                <span className="flex items-center gap-1"><Hash size={10} className="text-amber-500"/><span>Orden #{order.numero_orden}</span></span>
                {/* usuario_id null = pedido de invitado (se puede comprar sin cuenta). */}
                {order.usuario_id !== null && order.usuario_id !== undefined && (
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">Cliente #{order.usuario_id}</span>
                )}
              </div>
              {(order.cupon_codigo || Number(order.descuento_aplicado) > 0) && (
                <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] font-black uppercase">
                  {order.cupon_codigo && (
                    <span className="flex items-center gap-1 text-amber-500"><Ticket size={10} />{order.cupon_codigo}</span>
                  )}
                  {Number(order.descuento_aplicado) > 0 && (
                    <span className="text-emerald-500 font-mono">-{importeUsd(order.descuento_aplicado)}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="font-mono font-black text-amber-500">{importeUsd(order.total_pago)}</p>
              {order.estado === 'pendiente' ? (
                <div className="flex gap-2">
                  <a href={`https://wa.me/${order.whatsapp_cliente}`} target="_blank" className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><MessageCircle size={18}/></a>
                  <button onClick={() => finalizarPedido(order)} disabled={ocupadoPedido === order.id_pedido} title="Marcar como finalizado" className="p-2 bg-emerald-500 text-white rounded-lg disabled:opacity-30"><CheckCircle size={18}/></button>
                  {/* Cancelar solo tiene sentido en un pedido pendiente: en cualquier
                      otro estado el server responde 409. */}
                  <button onClick={() => cancelarPedido(order)} disabled={ocupadoPedido === order.id_pedido} title="Cancelar pedido y devolver el stock" className="p-2 bg-red-500/10 text-red-500 rounded-lg disabled:opacity-30"><X size={18}/></button>
                </div>
              ) : <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${order.estado === 'finalizado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{etiquetaEstadoPedido(order.estado)}</span>}
            </div>
          </div>
        ))}
        {currentOrders.length === 0 && (
          <div className="text-center py-10 text-slate-400 uppercase text-[10px] font-black italic">No hay pedidos en esta sección</div>
        )}
      </div>
    </div>
  );
}

function UserManual() {
  return (
    <div className="p-4 space-y-4 text-sm dark:text-slate-400">
      <h3 className="font-black dark:text-white uppercase flex items-center gap-2"><Disc size={18} className="text-amber-500"/> Ayuda rápida</h3>
      <p>• El buscador filtra por título o artista en tiempo real.</p>
      <p>• Los iconos de <strong>Música</strong> y <strong>Escudo</strong> indican el género y calidad cargados.</p>
      <p>• <strong>Sesión Robusta:</strong> El sistema envía un "latido" cada 10s para mantener tu acceso exclusivo y liberar la sesión al cerrar.</p>
    </div>
  );
}
