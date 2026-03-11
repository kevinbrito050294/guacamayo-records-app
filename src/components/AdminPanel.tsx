import { useState, useEffect } from 'react';
import { Settings, Plus, Upload, Book, ArrowLeft, List, Edit2, Save, X, Trash2 } from 'lucide-react';
import { VinylForm } from './admin/VinylForm';
import { BulkImporter } from './admin/BulkImporter';
import { CurrencyManager } from './admin/CurrencyManager';
import { ViniloCatalogo } from '../types/database';

type Tab = 'list' | 'form' | 'bulk' | 'currency' | 'manual';

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

  // Función para obtener la URL base del API dinámicamente
  const getApiUrl = () => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : `${window.location.protocol}//${window.location.host.replace(':5173', ':3001')}`;
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
      const res = await fetch(`${getApiUrl()}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error("Error en la subida");

      const data = await res.json();
      setFormEdit(prev => ({ ...prev, imagen_url: data.url }));
      alert("✅ Imagen subida con éxito");
    } catch (error) {
      console.error(error);
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
        alert("✅ Cambios guardados en la nube");
      }
    } catch (error) {
      alert("❌ Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este vinilo permanentemente?")) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/vinilos/${id}`, { method: 'DELETE' });
      if (res.ok) setVinilos(vinilos.filter(v => v.id !== id));
    } catch (error) {
      alert("❌ Error al eliminar");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-40 border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-900 dark:text-white" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Panel de Control</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <TabButton active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List />} title="Inventario" sub="Gestión total" />
          <TabButton active={activeTab === 'form'} onClick={() => setActiveTab('form')} icon={<Plus />} title="Nuevo" sub="Carga manual" />
          <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} icon={<Upload />} title="Importar" sub="Archivo CSV" />
          <TabButton active={activeTab === 'currency'} onClick={() => setActiveTab('currency')} icon={<Settings />} title="Tasas" sub="Dólar/ARS" />
          <TabButton active={activeTab === 'manual'} onClick={() => setActiveTab('manual')} icon={<Book />} title="Manual" sub="Ayuda" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors">
          {activeTab === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest">
                    <th className="pb-4 px-2 font-semibold">Producto / Portada</th>
                    <th className="pb-4 px-2 font-semibold text-center">Precio USD / Stock</th>
                    <th className="pb-4 px-2 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="text-center py-20 text-slate-400">Actualizando base de datos...</td></tr>
                  ) : vinilos.map((v) => (
                    <tr key={v.id} className="group bg-white dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-all">
                      {editandoId === v.id ? (
                        <>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-4">
                              <img 
                                src={formEdit.imagen_url || 'https://placehold.co/100x100?text=Subir'} 
                                className="w-20 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                                alt="Preview"
                              />
                              <div className="flex-1 space-y-2">
                                <input className="w-full border dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-md p-1.5 text-sm font-bold" value={formEdit.titulo || ''} onChange={e => setFormEdit({...formEdit, titulo: e.target.value})} placeholder="Título" />
                                <input className="w-full border dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 rounded-md p-1 text-xs" value={formEdit.artista || ''} onChange={e => setFormEdit({...formEdit, artista: e.target.value})} placeholder="Artista" />
                                <div className="flex flex-col gap-1.5">
                                  <input 
                                    className="w-full border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 rounded-md p-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono" 
                                    placeholder="Link de imagen externo..." 
                                    value={formEdit.imagen_url || ''} 
                                    onChange={e => setFormEdit({...formEdit, imagen_url: e.target.value})} 
                                  />
                                  <label className="flex items-center justify-center gap-2 py-1.5 px-2 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 rounded-md cursor-pointer hover:bg-indigo-600 dark:hover:bg-amber-400 transition-colors shadow-sm active:scale-95">
                                    <Upload size={12} />
                                    <span className="text-[10px] font-bold uppercase">{subiendo ? 'Subiendo...' : 'Subir Archivo Local'}</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={subiendo} />
                                  </label>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                             <div className="flex flex-col gap-2 items-center">
                               <div className="relative">
                                 <span className="absolute left-2 top-1.5 text-slate-400 text-xs">$</span>
                                 <input type="number" className="w-20 border dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-md p-1 pl-4 text-xs font-mono" value={formEdit.precio_venta || 0} onChange={e => setFormEdit({...formEdit, precio_venta: Number(e.target.value)})} />
                               </div>
                               <input type="number" className="w-20 border dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-md p-1 text-xs text-center" value={formEdit.stock_actual || 0} onChange={e => setFormEdit({...formEdit, stock_actual: Number(e.target.value)})} />
                             </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleSave(v.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm"><Save size={18}/></button>
                              <button onClick={() => setEditandoId(null)} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-200"><X size={18}/></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-4">
                              <img 
                                src={v.imagen_url || 'https://placehold.co/100x100?text=Sin+Foto'} 
                                className="w-14 h-14 rounded-lg object-cover bg-slate-100 dark:bg-slate-800" 
                                alt={v.titulo}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error+Img'; }}
                              />
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{v.titulo}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">{v.artista}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            <div className="font-mono font-bold text-indigo-600 dark:text-amber-500 bg-indigo-50 dark:bg-amber-500/10 px-2 py-1 rounded-md text-sm inline-block mb-1">
                              ${Number(v.precio_venta || 0).toFixed(2)}
                            </div>
                            <div className={`text-[10px] font-bold uppercase ${Number(v.stock_actual) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                              {v.stock_actual} en stock
                            </div>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditandoId(v.id); setFormEdit(v); }} className="p-2 text-indigo-600 dark:text-amber-500 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg"><Edit2 size={18} /></button>
                              <button onClick={() => handleDelete(v.id)} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"><Trash2 size={18} /></button>
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
    <button onClick={onClick} className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${active ? 'border-slate-900 dark:border-amber-500 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xl translate-y-[-2px]' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
      <div className={`mb-3 p-2 rounded-lg inline-block ${active ? 'bg-slate-800 dark:bg-amber-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'}`}>{icon}</div>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-60 mt-1">{sub}</p>
    </button>
  );
}

function UserManual() {
  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6 dark:text-slate-300">
      <h2 className="text-xl font-bold border-b dark:border-slate-800 pb-2">Manual Rápido</h2>
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
        <h3 className="font-bold text-blue-700 dark:text-blue-400 mb-1">📤 Gestión de Imágenes</h3>
        <p className="text-sm text-blue-600 dark:text-blue-300 italic mb-2">Tienes flexibilidad total:</p>
        <ul className="text-sm text-blue-800 dark:text-blue-200 list-disc ml-4 space-y-1">
          <li><strong>Link:</strong> Útil para portadas rápidas de la web.</li>
          <li><strong>Local:</strong> Recomendado para fotos propias. Al subir, se genera una URL única vinculada a tu servidor en Railway.</li>
        </ul>
      </div>
    </div>
  );
}