import { useState, useEffect } from 'react';
import { 
  Settings, Plus, Upload, Book, ArrowLeft, List, 
  Edit2, Save, X, Trash2, ShoppingBag, CheckCircle, 
  Hash, MessageCircle 
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

  // CORRECCIÓN: URL de API robusta para producción
  const getApiUrl = () => {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:3001';
    }
    // En Railway, el frontend y backend suelen compartir el mismo dominio o estar en subdominios claros
    return 'https://guacamayorecords.up.railway.app';
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
    cargarVinilos();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('imagen', file);
    try {
      setSubiendo(true);
      const res = await fetch(`${getApiUrl()}/api/upload`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Error en la subida");
      const data = await res.json();
      setFormEdit(prev => ({ ...prev, imagen_url: data.url }));
      alert("✅ Imagen subida con éxito");
    } catch (error) {
      alert("❌ Error al subir el archivo");
    } finally {
      setSubiendo(false);
    }
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
        alert("✅ Cambios guardados");
      }
    } catch (error) { alert("❌ Error de conexión"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vinilo permanentemente?")) return;
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Panel de Control</h1>
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          {activeTab === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-widest">
                    <th className="pb-4 px-2">Producto</th>
                    <th className="pb-4 px-2 text-center">Precio/Stock</th>
                    <th className="pb-4 px-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="text-center py-20">Actualizando...</td></tr>
                  ) : vinilos.map((v) => (
                    <tr key={v.id} className="bg-white dark:bg-slate-800/40 border-y dark:border-slate-800">
                      {editandoId === v.id ? (
                        <>
                          <td className="py-3 px-2">
                            <div className="flex flex-col gap-2">
                              <input className="border rounded p-1 dark:bg-slate-900 dark:text-white" value={formEdit.titulo || ''} onChange={e => setFormEdit({...formEdit, titulo: e.target.value})} />
                              <input className="text-xs border rounded p-1 dark:bg-slate-900 dark:text-slate-300" value={formEdit.artista || ''} onChange={e => setFormEdit({...formEdit, artista: e.target.value})} />
                              <label className="text-[10px] bg-slate-200 dark:bg-slate-700 p-1 rounded cursor-pointer text-center">
                                {subiendo ? 'Subiendo...' : 'Cambiar Imagen'}
                                <input type="file" className="hidden" onChange={handleFileUpload} />
                              </label>
                            </div>
                          </td>
                          <td className="text-center">
                            <input type="number" className="w-16 border rounded p-1 dark:bg-slate-900 mb-1" value={formEdit.precio_venta || 0} onChange={e => setFormEdit({...formEdit, precio_venta: Number(e.target.value)})} />
                            <input type="number" className="w-16 border rounded p-1 dark:bg-slate-900" value={formEdit.stock_actual || 0} onChange={e => setFormEdit({...formEdit, stock_actual: Number(e.target.value)})} />
                          </td>
                          <td className="text-right">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => handleSave(v.id)} className="p-2 bg-emerald-500 text-white rounded"><Save size={16}/></button>
                              <button onClick={() => setEditandoId(null)} className="p-2 bg-slate-200 rounded"><X size={16}/></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <img src={v.imagen_url || ''} className="w-12 h-12 rounded object-cover" alt={v.titulo} />
                              <div>
                                <div className="font-bold dark:text-white">{v.titulo}</div>
                                <div className="text-xs text-slate-500">{v.artista}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="text-indigo-600 dark:text-amber-500 font-bold">${Number(v.precio_venta).toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400">{v.stock_actual} en stock</div>
                          </td>
                          <td className="text-right px-2">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => { setEditandoId(v.id); setFormEdit(v); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 size={18}/></button>
                              <button onClick={() => handleDelete(v.id)} className="p-2 text-red-400 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
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

          {activeTab === 'orders' && <OrdersList getApiUrl={getApiUrl} />}
          {activeTab === 'form' && <VinylForm onSuccess={cargarVinilos} />}
          {activeTab === 'bulk' && <BulkImporter />}
          {activeTab === 'currency' && <CurrencyManager />}
          {activeTab === 'manual' && <UserManual />}
        </div>
      </main>
    </div>
  );
}

// --- SUB-COMPONENTE CORREGIDO ---
function OrdersList({ getApiUrl }: { getApiUrl: () => string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiUrl()}/api/pedidos`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) { 
      console.error("Error al obtener pedidos:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const finalizarPedido = async (id_pedido: number) => {
    if (!id_pedido) {
        alert("❌ Error: No se encontró el ID del pedido.");
        return;
    }

    if (!confirm("¿Marcar este pedido como entregado y pagado?")) return;
    
    try {
        const res = await fetch(`${getApiUrl()}/api/pedidos/${id_pedido}/finalizar`, { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            alert("✅ Venta finalizada con éxito");
            fetchOrders(); // Recargar lista
        } else {
            const errData = await res.json();
            alert(`❌ Error: ${errData.error || "No se pudo actualizar"}`);
        }
    } catch (error) {
        alert("❌ Error de red al intentar finalizar el pedido");
    }
  };

  if (loading) return <div className="text-center py-10 dark:text-slate-400 font-mono text-xs">ACTUALIZANDO REGISTROS...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold dark:text-white uppercase tracking-tight">Registro de Pedidos</h2>
        <button onClick={fetchOrders} className="text-xs text-amber-500 font-bold hover:underline">REFRESCAR</button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">No hay pedidos registrados en el sistema.</div>
      ) : (
        <div className="grid gap-3">
          {orders.map(order => {
            // USAR ID_PEDIDO (así viene de la DB)
            const orderKey = order.id_pedido; 

            return (
              <div key={orderKey} className={`p-4 rounded-xl border transition-all ${order.estado === 'finalizado' ? 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-800/50 border-amber-500/30 shadow-lg shadow-amber-500/5'}`}>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded flex items-center gap-1">
                        <Hash size={10} /> {order.numero_orden || 'SIN NRO'}
                      </span>
                      <p className="font-bold dark:text-white text-lg">{order.nombre_cliente}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-slate-500">📱 {order.whatsapp_cliente}</p>
                      <p className="text-xs text-slate-400 italic">Fecha: {new Date(order.fecha).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-mono font-bold text-amber-500">${order.total_pago}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${order.estado === 'finalizado' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                      {order.estado}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                  <a 
                    href={`https://wa.me/${order.whatsapp_cliente.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${order.nombre_cliente}, te hablo de Guacamayo Records por tu pedido #${order.numero_orden}`)}`} 
                    target="_blank" 
                    className="flex items-center gap-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    <MessageCircle size={14} /> CONTACTAR WHATSAPP
                  </a>
                  
                  {order.estado !== 'finalizado' && (
                    <button 
                      onClick={() => finalizarPedido(order.id_pedido)} 
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-transform active:scale-95"
                    >
                      <CheckCircle size={14} /> FINALIZAR VENTA
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ... TabButton y UserManual se mantienen igual ...
function TabButton({ active, onClick, icon, title, sub }: any) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl border-2 text-left transition-all ${active ? 'border-slate-900 dark:border-amber-500 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
      <div className={`mb-2 p-2 rounded-lg inline-block ${active ? 'bg-slate-800 dark:bg-amber-600/20' : 'bg-slate-100 dark:bg-slate-800'}`}>{icon}</div>
      <p className="font-bold text-xs">{title}</p>
      <p className="text-[10px] uppercase opacity-60 tracking-tighter">{sub}</p>
    </button>
  );
}

function UserManual() {
  return (
    <div className="p-4 space-y-4 dark:text-slate-400 text-sm">
      <h3 className="font-bold text-slate-900 dark:text-white">Gestión de Pedidos</h3>
      <div className="space-y-2">
        <p className="flex items-center gap-2">• <span className="bg-amber-500/20 text-amber-500 px-1 rounded font-mono">#GR-XXXX</span> Es el código de seguimiento del pedido.</p>
        <p>• El botón de WhatsApp abre el chat con el número del cliente automáticamente.</p>
        <p>• Al presionar "Finalizar Venta", el estado cambia y el registro se archiva visualmente.</p>
        <p>• El stock ya fue descontado al momento en que el cliente confirmó su carrito.</p>
      </div>
    </div>
  );
}