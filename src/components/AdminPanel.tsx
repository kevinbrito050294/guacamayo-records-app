import { useState, useEffect, useRef } from 'react';
import { 
  Settings, Plus, Upload, Book, ArrowLeft, List, 
  Edit2, Save, X, Trash2, ShoppingBag, CheckCircle, 
  Hash, MessageCircle, Layers, Disc, Star, Search, Ticket, Music, ShieldCheck, LogOut, AlertTriangle
} from 'lucide-react';

// Componentes administrativos externos
import { VinylForm } from './admin/VinylForm';
import { BulkImporter } from './admin/BulkImporter';
import { CurrencyManager } from './admin/CurrencyManager';
import { ViniloCatalogo } from '../types/database';

type Tab = 'list' | 'form' | 'bulk' | 'currency' | 'manual' | 'orders' | 'coupons';

interface AdminPanelProps {
  onBack: () => void;
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

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- LÓGICA DE SESIÓN Y SEGURIDAD ---
  const cerrarSesionTotal = () => {
    localStorage.removeItem('admin_session_active');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onBack();
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      alert("Sesión finalizada por inactividad (15 min)");
      cerrarSesionTotal();
    }, 15 * 60 * 1000);
  };

  useEffect(() => {
    if (localStorage.getItem('admin_session_active') === 'true') {
      setSessionError(true);
      return;
    }

    localStorage.setItem('admin_session_active', 'true');
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    const handleUnload = () => localStorage.removeItem('admin_session_active');
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      handleUnload();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // --- API Y DATOS ---
  const getApiUrl = () => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : 'https://guacamayorecords.up.railway.app';
  };

  const cargarVinilos = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/vinilos`);
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
    v.artista?.toLowerCase().includes(busquedaInv.toLowerCase())
  );

  // --- MANEJO DE IMÁGENES ---
  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    Array.from(files).forEach(file => { formData.append('imagenes', file); });

    try {
      setSubiendo(true);
      const res = await fetch(`${getApiUrl()}/api/upload-multiple`, { 
        method: 'POST', 
        body: formData 
      });

      if (!res.ok) throw new Error("Error en la subida");
      
      const data = await res.json(); 
      const nuevasFotos = Array.isArray(data.urls) ? data.urls : [];
      const fotosActuales = formEdit.imagen_url ? formEdit.imagen_url.split(',') : [];
      const mixFinal = [...fotosActuales, ...nuevasFotos].filter(url => url !== '').join(',');
      
      setFormEdit(prev => ({ ...prev, imagen_url: mixFinal }));
      alert(`✅ ${nuevasFotos.length} imágenes añadidas`);
    } catch (error) {
      alert("❌ Error al subir imagen");
    } finally {
      setSubiendo(false);
    }
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

  // --- CRUD ACCIONES ---
  const handleSave = async (id: string) => {
    try {
      const payload = { 
        ...formEdit,
        precio_venta: Number(formEdit.precio_venta || 0),
        stock_actual: Number(formEdit.stock_actual || 0)
      };
      const res = await fetch(`${getApiUrl()}/api/vinilos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setVinilos(vinilos.map(v => v.id === id ? { ...v, ...payload } as ViniloCatalogo : v));
        setEditandoId(null);
        alert("✅ Cambios guardados");
      }
    } catch (error) { alert("❌ Error de conexión"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vinilo?")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/vinilos/${id}`, { method: 'DELETE' });
      if (res.ok) setVinilos(vinilos.filter(v => v.id !== id));
    } catch (error) { alert("❌ Error al eliminar"); }
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
          <p className="text-slate-500 text-sm mb-6">Ya hay una sesión abierta en otra pestaña.</p>
          <button onClick={onBack} className="w-full bg-slate-900 dark:bg-white dark:text-slate-950 text-white py-3 rounded-xl font-black text-xs uppercase">VOLVER</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-40 border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={cerrarSesionTotal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Panel de Control</h1>
          </div>
          <button onClick={cerrarSesionTotal} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg shadow-red-500/20">
            <LogOut size={16} /> Finalizar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List />} title="Inventario" sub="Gestión" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag />} title="Pedidos" sub="Ventas" />
          <TabButton active={activeTab === 'coupons'} onClick={() => setActiveTab('coupons')} icon={<Ticket />} title="Cupones" sub="Promos" />
          <TabButton active={activeTab === 'form'} onClick={() => setActiveTab('form')} icon={<Plus />} title="Nuevo" sub="Carga" />
          <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} icon={<Upload />} title="Importar" sub="CSV" />
          <TabButton active={activeTab === 'currency'} onClick={() => setActiveTab('currency')} icon={<Settings />} title="Tasas" sub="Dólar/ARS" />
          <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} icon={<Book />} title="Manual" sub="Ayuda" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
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

              <div className="overflow-x-auto">
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
                                  {/* Título en su propia fila */}
                                  <div>
                                    <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Título</label>
                                    <input className="w-full font-bold border-none rounded-xl p-3 dark:bg-slate-900 dark:text-white text-sm" value={formEdit.titulo || ''} onChange={e => setFormEdit({...formEdit, titulo: e.target.value})} />
                                  </div>
                                  
                                  {/* Artista y Género compartiendo fila */}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Artista</label>
                                      <input className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" value={formEdit.artista || ''} onChange={e => setFormEdit({...formEdit, artista: e.target.value})} />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Género</label>
                                      <input 
                                        className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" 
                                        value={formEdit.genero || ''} 
                                        onChange={e => setFormEdit({...formEdit, genero: e.target.value})} 
                                        placeholder="Ej: Rock"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex gap-4">
                                    <div className="flex-1">
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Precio USD</label>
                                      <input type="number" className="w-full border-none rounded-xl p-3 dark:bg-slate-900 text-sm font-bold" value={formEdit.precio_venta || 0} onChange={e => setFormEdit({...formEdit, precio_venta: Number(e.target.value)})} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Stock</label>
                                      <input type="number" className="w-full border-none rounded-xl p-3 dark:bg-slate-900 text-sm font-bold" value={formEdit.stock_actual || 0} onChange={e => setFormEdit({...formEdit, stock_actual: Number(e.target.value)})} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Calidad</label>
                                      <select className="w-full border-none rounded-xl p-3 dark:bg-slate-900 text-sm font-bold text-amber-500" value={formEdit.calidad || ''} onChange={e => setFormEdit({...formEdit, calidad: e.target.value as any})}>
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
                                    
                                    <label className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                                      subiendo 
                                        ? 'border-amber-500 bg-amber-500/10 cursor-wait' 
                                        : 'border-slate-300 dark:border-slate-700 cursor-pointer text-slate-400 hover:text-amber-500'
                                    }`}>
                                      {subiendo ? (
                                        <Disc className="animate-spin text-amber-500" size={24} />
                                      ) : (
                                        <>
                                          <Plus size={24} />
                                          <input 
                                            type="file" 
                                            className="hidden" 
                                            multiple 
                                            onChange={handleMultipleFileUpload} 
                                            disabled={subiendo} 
                                          />
                                        </>
                                      )}
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
                                    <div className="flex gap-2">
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
                                <div className="flex justify-end gap-1">
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

          {activeTab === 'orders' && <OrdersList getApiUrl={getApiUrl} onOrderUpdate={cargarVinilos} />}
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

function TabButton({ active, onClick, icon, title, sub }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl border-2 text-left transition-all ${active ? 'border-slate-900 dark:border-amber-500 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-amber-500/50'}`}>
      <div className={`mb-2 p-2 rounded-lg inline-block ${active ? 'bg-slate-800 dark:bg-amber-600/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{icon}</div>
      <p className="font-bold text-xs">{title}</p>
      <p className="text-[10px] uppercase opacity-60 tracking-tighter">{sub}</p>
    </button>
  );
}

function CouponManager({ getApiUrl }: { getApiUrl: () => string }) {
  const [cupones, setCupones] = useState<any[]>([]);
  const [nuevo, setNuevo] = useState({ codigo: '', tipo: 'porcentaje', valor: '', fecha_expiracion: '', uso_maximo: '' });
  
  const fetchCupones = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones`);
      const data = await res.json();
      setCupones(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { fetchCupones(); }, []);

  const crearCupon = async () => {
    if (!nuevo.codigo || !nuevo.valor) return alert("Completa código y valor");
    try {
      const res = await fetch(`${getApiUrl()}/api/admin/cupones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo)
      });
      if (res.ok) {
        alert("✅ Cupón creado");
        setNuevo({ codigo: '', tipo: 'porcentaje', valor: '', fecha_expiracion: '', uso_maximo: '' });
        fetchCupones();
      }
    } catch (e) { alert("Error al crear"); }
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-800">
        <h3 className="text-xs font-black uppercase tracking-widest mb-4 text-amber-500">Crear Nuevo Cupón</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input placeholder="CÓDIGO" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none uppercase font-bold" value={nuevo.codigo} onChange={e => setNuevo({...nuevo, codigo: e.target.value})} />
          <select className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none" value={nuevo.tipo} onChange={e => setNuevo({...nuevo, tipo: e.target.value})}>
            <option value="porcentaje">% Porcentaje</option>
            <option value="fijo">Monto Fijo (USD)</option>
          </select>
          <input type="number" placeholder="Valor" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none" value={nuevo.valor} onChange={e => setNuevo({...nuevo, valor: e.target.value})} />
          <input type="date" className="bg-white dark:bg-slate-900 p-3 rounded-xl text-sm border-none ring-1 ring-slate-200 dark:ring-slate-700 outline-none text-slate-400" value={nuevo.fecha_expiracion} onChange={e => setNuevo({...nuevo, fecha_expiracion: e.target.value})} />
          <button onClick={crearCupon} className="bg-amber-500 text-slate-950 font-black rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2"><Plus size={18}/> CREAR</button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr><th className="p-4">Código</th><th className="p-4">Beneficio</th><th className="p-4">Expiración</th><th className="p-4 text-center">Usos</th><th className="p-4 text-right">Estado</th></tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800">
            {cupones.map(c => (
              <tr key={c.id} className="dark:text-slate-300">
                <td className="p-4 font-bold text-amber-500">{c.codigo}</td>
                <td className="p-4">{c.tipo === 'porcentaje' ? `${c.valor}%` : `USD ${c.valor}`}</td>
                <td className="p-4 text-xs">{c.fecha_expiracion ? new Date(c.fecha_expiracion).toLocaleDateString() : '∞ Sin límite'}</td>
                <td className="p-4 text-center text-xs font-mono">{c.usos_actuales} / {c.uso_maximo || '∞'}</td>
                <td className="p-4 text-right"><span className={`text-[9px] font-black px-2 py-1 rounded ${c.activo ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{c.activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrdersList({ getApiUrl, onOrderUpdate }: { getApiUrl: () => string, onOrderUpdate: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'pending' | 'history'>('pending');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/pedidos`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };
  useEffect(() => { fetchOrders(); }, []);

  const finalizarPedido = async (id: number) => {
    if (!confirm("¿Finalizar?")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/pedidos/${id}/finalizar`, { method: 'PUT' });
      if (res.ok) fetchOrders();
    } catch (error) { alert("Error"); }
  };

  const cancelarPedido = async (order: any) => {
    if (!confirm("¿Cancelar?")) return;
    try {
      const items = order.items ? (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) : [];
      const res = await fetch(`${getApiUrl()}/api/pedidos/${order.id_pedido}/cancelar`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }) 
      });
      if (res.ok) { fetchOrders(); onOrderUpdate(); }
    } catch (error) { alert("Error"); }
  };

  const currentOrders = filterTab === 'pending' ? orders.filter(o => o.estado === 'pendiente') : orders.filter(o => o.estado !== 'pendiente');

  if (loading) return <div className="text-center py-10 text-[10px] opacity-50 font-black">CARGANDO...</div>;
  return (
    <div className="space-y-6">
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-full max-w-md">
        <button onClick={() => setFilterTab('pending')} className={`flex-1 py-2 rounded-xl text-[10px] font-black ${filterTab === 'pending' ? 'bg-white dark:bg-slate-700 text-amber-500' : 'text-slate-500'}`}>PENDIENTES</button>
        <button onClick={() => setFilterTab('history')} className={`flex-1 py-2 rounded-xl text-[10px] font-black ${filterTab === 'history' ? 'bg-white dark:bg-slate-700 text-emerald-500' : 'text-slate-500'}`}>HISTORIAL</button>
      </div>
      <div className="grid gap-4">
        {currentOrders.map(order => (
          <div key={order.id_pedido} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border dark:border-slate-800 flex justify-between items-center">
            <div>
              <p className="font-bold text-lg dark:text-white">{order.nombre_cliente}</p>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-black uppercase"><Hash size={10} className="text-amber-500"/><span>Orden #{order.numero_orden}</span></div>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-mono font-black text-amber-500">${order.total_pago}</p>
              {order.estado === 'pendiente' ? (
                <div className="flex gap-2">
                  <a href={`https://wa.me/${order.whatsapp_cliente}`} target="_blank" className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><MessageCircle size={18}/></a>
                  <button onClick={() => finalizarPedido(order.id_pedido)} className="p-2 bg-emerald-500 text-white rounded-lg"><CheckCircle size={18}/></button>
                  <button onClick={() => cancelarPedido(order)} className="p-2 bg-red-500/10 text-red-500 rounded-lg"><X size={18}/></button>
                </div>
              ) : <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${order.estado === 'finalizado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{order.estado}</span>}
            </div>
          </div>
        ))}
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
      <p>• <strong>Sesión Única:</strong> Solo se permite una pestaña de administración abierta.</p>
    </div>
  );
}