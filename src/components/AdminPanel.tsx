import { useState, useEffect } from 'react';
import { 
  Settings, Plus, Upload, Book, ArrowLeft, List, 
  Edit2, Save, X, Trash2, ShoppingBag, CheckCircle, 
  Hash, MessageCircle, Layers, Disc, Star
} from 'lucide-react';
import { VinylForm } from './admin/VinylForm';
import { BulkImporter } from './admin/BulkImporter';
import { CurrencyManager } from './admin/CurrencyManager';
import { ViniloCatalogo } from '../types/database';

type Tab = 'list' | 'form' | 'bulk' | 'currency' | 'manual' | 'orders';

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

  useEffect(() => { cargarVinilos(); }, []);

  // --- GESTIÓN DE IMÁGENES ---
  const handleMultipleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('imagenes', file);
    });

    try {
      setSubiendo(true);
      const res = await fetch(`${getApiUrl()}/api/upload-multiple`, { 
        method: 'POST', 
        body: formData 
      });
      if (!res.ok) throw new Error("Error en la subida");
      const data = await res.json();
      const fotosActuales = formEdit.imagen_url ? formEdit.imagen_url.split(',') : [];
      const nuevasFotos = data.url.split(',');
      const mixFinal = [...fotosActuales, ...nuevasFotos].filter(url => url !== '').join(',');
      setFormEdit(prev => ({ ...prev, imagen_url: mixFinal }));
      alert(`✅ Imágenes añadidas a la galería`);
    } catch (error) {
      alert("❌ Error al subir imágenes");
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

  const handleSave = async (id: string) => {
    try {
      const payload = { 
        titulo: formEdit.titulo,
        artista: formEdit.artista,
        precio_venta: Number(formEdit.precio_venta || 0),
        stock_actual: Number(formEdit.stock_actual || 0),
        imagen_url: formEdit.imagen_url || '' 
      };
      const res = await fetch(`${getApiUrl()}/api/vinilos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setVinilos(vinilos.map(v => v.id === id ? { ...v, ...payload } as ViniloCatalogo : v));
        setEditandoId(null);
        alert("✅ Cambios guardados en Guacamayo Records");
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-40 border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Panel de Control</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List />} title="Inventario" sub="Gestión" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingBag />} title="Pedidos" sub="Ventas" />
          <TabButton active={activeTab === 'form'} onClick={() => setActiveTab('form')} icon={<Plus />} title="Nuevo" sub="Carga" />
          <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} icon={<Upload />} title="Importar" sub="CSV" />
          <TabButton active={activeTab === 'currency'} onClick={() => setActiveTab('currency')} icon={<Settings />} title="Tasas" sub="Dólar/ARS" />
          <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} icon={<Book />} title="Manual" sub="Ayuda" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          {activeTab === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-400 text-[10px] uppercase tracking-widest font-black">
                    <th className="pb-4 px-2">Producto / Galería</th>
                    <th className="pb-4 px-2 text-center">Precio/Stock</th>
                    <th className="pb-4 px-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="text-center py-20 opacity-50"><Disc className="animate-spin mx-auto mb-2 text-amber-500" /> CARGANDO...</td></tr>
                  ) : vinilos.map((v) => (
                    <tr key={v.id} className="bg-white dark:bg-slate-800/40 border-y dark:border-slate-800 group align-top">
                      {editandoId === v.id ? (
                        <td colSpan={3} className="p-6 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-4">
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Título</label>
                                <input className="w-full font-bold border-none rounded-xl p-3 dark:bg-slate-900 dark:text-white" value={formEdit.titulo || ''} onChange={e => setFormEdit({...formEdit, titulo: e.target.value})} />
                              </div>
                              <div>
                                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Artista</label>
                                <input className="w-full text-sm border-none rounded-xl p-3 dark:bg-slate-900 dark:text-slate-300" value={formEdit.artista || ''} onChange={e => setFormEdit({...formEdit, artista: e.target.value})} />
                              </div>
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Precio USD</label>
                                  <input type="number" className="w-full border-none rounded-xl p-3 dark:bg-slate-900" value={formEdit.precio_venta || 0} onChange={e => setFormEdit({...formEdit, precio_venta: Number(e.target.value)})} />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Stock</label>
                                  <input type="number" className="w-full border-none rounded-xl p-3 dark:bg-slate-900" value={formEdit.stock_actual || 0} onChange={e => setFormEdit({...formEdit, stock_actual: Number(e.target.value)})} />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-4">
                                <button onClick={() => handleSave(v.id)} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"><Save size={16}/> GUARDAR</button>
                                <button onClick={() => setEditandoId(null)} className="px-4 bg-slate-300 dark:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-tighter"><X size={16}/></button>
                              </div>
                            </div>
                            <div className="md:col-span-2 space-y-3">
                              <label className="text-[10px] font-black uppercase text-slate-500 block">Galería (La primera es la Principal)</label>
                              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                {formEdit.imagen_url?.split(',').filter(u => u !== '').map((url, idx) => (
                                  <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${idx === 0 ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-transparent'}`}>
                                    <img src={url} className="w-full h-full object-cover" alt={`Preview ${idx}`} />
                                    {idx === 0 && (
                                      <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded shadow-md flex items-center gap-1">
                                        <Star size={8} fill="currentColor"/> PORTADA
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      {idx !== 0 && (
                                        <button onClick={() => hacerPrincipal(idx)} className="p-1.5 bg-amber-500 text-slate-950 rounded-lg hover:scale-110 transition-transform"><Star size={14}/></button>
                                      )}
                                      <button onClick={() => eliminarFoto(idx)} className="p-1.5 bg-red-500 text-white rounded-lg hover:scale-110 transition-transform"><Trash2 size={14}/></button>
                                    </div>
                                  </div>
                                ))}
                                <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-amber-500/5 hover:border-amber-500 transition-all text-slate-400 hover:text-amber-500">
                                  <Plus size={24} />
                                  <span className="text-[8px] font-black uppercase mt-1">Añadir</span>
                                  <input type="file" className="hidden" multiple onChange={handleMultipleFileUpload} />
                                </label>
                              </div>
                              {subiendo && <p className="text-[10px] font-black text-amber-500 animate-pulse tracking-widest">SUBIENDO ARCHIVOS...</p>}
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img src={v.imagen_url?.split(',')[0] || ''} className="w-14 h-14 rounded-xl object-cover shadow-md" alt={v.titulo} />
                                {v.imagen_url && v.imagen_url.split(',').length > 1 && (
                                  <span className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 text-[8px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">
                                    <Layers size={10} /> {v.imagen_url.split(',').length}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold dark:text-white uppercase tracking-tighter italic">{v.titulo}</div>
                                <div className="text-xs text-slate-500 font-medium">{v.artista}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="text-amber-500 font-black text-lg font-mono">${Number(v.precio_venta).toLocaleString()}</div>
                            <div className={`text-[10px] font-black uppercase ${v.stock_actual > 0 ? 'text-slate-400' : 'text-red-500'}`}>
                              {v.stock_actual} EN STOCK
                            </div>
                          </td>
                          <td className="text-right px-2">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => { setEditandoId(v.id); setFormEdit(v); }} className="p-2 text-slate-400 hover:text-amber-500 transition-colors"><Edit2 size={20}/></button>
                              <button onClick={() => handleDelete(v.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'orders' && <OrdersList getApiUrl={getApiUrl} onOrderUpdate={cargarVinilos} />}
          {activeTab === 'form' && <VinylForm onSuccess={cargarVinilos} />}
          {activeTab === 'bulk' && <BulkImporter />}
          {activeTab === 'currency' && <CurrencyManager />}
          {activeTab === 'manual' && <UserManual />}
        </div>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, title, sub }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl border-2 text-left transition-all ${active ? 'border-slate-900 dark:border-amber-500 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-amber-500/50'}`}>
      <div className={`mb-2 p-2 rounded-lg inline-block ${active ? 'bg-slate-800 dark:bg-amber-600/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{icon}</div>
      <p className="font-bold text-xs">{title}</p>
      <p className="text-[10px] uppercase opacity-60 tracking-tighter">{sub}</p>
    </button>
  );
}

function OrdersList({ getApiUrl, onOrderUpdate }: { getApiUrl: () => string, onOrderUpdate: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/pedidos`);
      const data = await res.json();
      const sortedData = Array.isArray(data) ? data.sort((a, _) => (a.estado === 'cancelado' ? 1 : -1)) : [];
      setOrders(sortedData);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const finalizarPedido = async (id: number) => {
    if (!confirm("¿Marcar venta como finalizada?")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/pedidos/${id}/finalizar`, { method: 'PUT' });
      if (res.ok) fetchOrders();
    } catch (error) { alert("❌ Error al finalizar"); }
  };

  const cancelarPedido = async (order: any) => {
    if (!confirm(`⚠️ ¿Cancelar el pedido de ${order.nombre_cliente}? El stock se devolverá automáticamente.`)) return;
    
    try {
      // Intentamos recuperar los items guardados en el pedido (si los hay)
      // Como por ahora no tienes tabla detalles, el backend requiere que le mandes qué devolver.
      const itemsADevolver = order.items ? JSON.parse(order.items) : [];

      const res = await fetch(`${getApiUrl()}/api/pedidos/${order.id_pedido}/cancelar`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsADevolver }) 
      });

      if (res.ok) {
        alert("✅ Pedido cancelado y stock restablecido");
        fetchOrders();
        onOrderUpdate(); // Refresca la lista de vinilos también
      }
    } catch (error) { alert("❌ Error al cancelar"); }
  };

  if (loading) return <div className="text-center py-10 font-mono text-xs opacity-50 tracking-widest">ACTUALIZANDO REGISTROS...</div>;

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <p className="text-center text-slate-500 py-10">No hay pedidos registrados.</p>
      ) : orders.map(order => {
        const isCancelado = order.estado === 'cancelado';
        const isFinalizado = order.estado === 'finalizado';

        return (
          <div key={order.id_pedido} className={`p-5 rounded-2xl border transition-all flex justify-between items-center group ${isCancelado ? 'bg-slate-100 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800 opacity-60' : 'bg-slate-50 dark:bg-slate-800/30 dark:border-slate-800 hover:border-amber-500/30'}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-black px-1.5 rounded flex items-center gap-0.5 ${isCancelado ? 'bg-slate-400 text-white' : 'bg-amber-500 text-slate-950'}`}>
                  <Hash size={8}/> {order.numero_orden}
                </span>
                <p className={`font-bold text-lg ${isCancelado ? 'line-through text-slate-500' : 'dark:text-white'}`}>{order.nombre_cliente}</p>
                {isCancelado && <span className="text-[10px] font-black text-red-500 uppercase ml-2 italic">Cancelado</span>}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 font-mono uppercase tracking-tighter">FECHA: {new Date(order.fecha).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`font-black text-xl font-mono ${isCancelado ? 'text-slate-400' : 'text-amber-500'}`}>${order.total_pago}</p>
              </div>
              <div className="flex gap-2">
                {!isCancelado && !isFinalizado && (
                  <>
                    <a href={`https://wa.me/${order.whatsapp_cliente}`} target="_blank" className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                      <MessageCircle size={20} />
                    </a>
                    <button onClick={() => finalizarPedido(order.id_pedido)} className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all">
                      <CheckCircle size={20}/>
                    </button>
                    <button onClick={() => cancelarPedido(order)} className="p-2.5 bg-white dark:bg-slate-900 text-red-500 border border-red-100 dark:border-red-900/30 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                      <X size={20}/>
                    </button>
                  </>
                )}
                {isFinalizado && (
                  <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-3 py-2 rounded-xl uppercase tracking-widest border border-emerald-500/20">Completado</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserManual() {
  return (
    <div className="p-4 space-y-6 dark:text-slate-400 text-sm">
      <div className="space-y-2">
        <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-2"><Disc size={18} className="text-amber-500"/> Gestión de Stock</h3>
        <p>• Al cancelar un pedido, el sistema devolverá automáticamente los discos al stock.</p>
        <p>• Editá precios y cantidades directamente desde la lista de inventario.</p>
      </div>
      <div className="space-y-2">
        <h3 className="font-black text-slate-900 dark:text-white uppercase flex items-center gap-2"><Layers size={18} className="text-amber-500"/> Imágenes Múltiples</h3>
        <p>• La primera foto de la cuadrícula es la **PRINCIPAL** (Portada).</p>
        <p>• Usá el icono de la estrella para cambiar la foto de portada.</p>
      </div>
    </div>
  );
}