import { useState, useEffect } from 'react';
import { ConfiguracionDivisa } from '../../types/database';
import { Save, AlertCircle, Check, TrendingUp, Clock } from 'lucide-react';

export function CurrencyManager() {
  const [tasas, setTasas] = useState<ConfiguracionDivisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getApiUrl = () => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : 'https://guacamayorecords.up.railway.app';
  };

  useEffect(() => {
    cargarTasas();
  }, []);

  async function cargarTasas() {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/api/configuracion_divisas`);
      
      if (!response.ok) throw new Error('Error al conectar con el servidor');
      
      const data = await response.json();

      // PROTECCIÓN: Verificamos que 'data' sea realmente un Array antes de setearlo
      if (Array.isArray(data)) {
        setTasas(data);
      } else {
        console.error('La API no devolvió un array:', data);
        setTasas([]); // Seteamos array vacío para que .map no falle
        setMessage({ type: 'error', text: 'El servidor respondió con un formato inesperado' });
      }
    } catch (error) {
      console.error('Error loading rates:', error);
      setTasas([]); // Evita que la interfaz se rompa
      setMessage({ type: 'error', text: 'Error al cargar las tasas de la base de datos' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTasa(tipo: string, nuevaTasa: number) {
    if (nuevaTasa <= 0) {
      setMessage({ type: 'error', text: 'La tasa debe ser mayor a 0' });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${getApiUrl()}/api/configuracion_divisas/${tipo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasa: nuevaTasa })
      });

      if (!response.ok) throw new Error('No se pudo actualizar');

      setMessage({ type: 'success', text: `Tasa ${tipo} actualizada correctamente` });
      setTimeout(() => setMessage(null), 3000);
      await cargarTasas(); 
    } catch (error) {
      console.error('Error saving rate:', error);
      setMessage({ type: 'error', text: 'Error al guardar la tasa' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 dark:text-slate-400">
        <div className="animate-spin text-3xl mb-4">💿</div>
        <p className="font-mono text-xs tracking-widest uppercase">Consultando tipos de cambio...</p>
      </div>
    );
  }

  const etiquetas: { [key: string]: string } = {
    DOLAR_BLUE: 'Dólar Blue (ARS)',
    USDT: 'USDT (Cripto)',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500 rounded-lg text-slate-950">
          <TrendingUp size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold dark:text-white uppercase tracking-tight">Gestor de Divisas</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cotizaciones en tiempo real</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 transition-all animate-in slide-in-from-top-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
          }`}
        >
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Usamos safe navigation o un array vacío por si acaso */}
        {(tasas || []).map((tasa) => (
          <div
            key={tasa.id}
            className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="mb-4">
              <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">
                {etiquetas[tasa.tipo] || tasa.tipo}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tasa.tasa}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTasas(prev => prev.map(t => 
                      t.id === tasa.id ? { ...t, tasa: isNaN(val) ? 0 : val } : t
                    ));
                  }}
                  className="w-full pl-7 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white font-mono text-lg transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock size={12} />
                <span className="text-[10px] uppercase font-medium">
                  {tasa.ultima_actualizacion ? new Date(tasa.ultima_actualizacion).toLocaleDateString('es-AR') : '---'}
                </span>
              </div>
              
              <button
                onClick={() => handleSaveTasa(tasa.tipo, tasa.tasa)}
                disabled={saving}
                className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 disabled:opacity-50 text-white dark:text-slate-950 px-5 py-2 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                {saving ? '...' : 'ACTUALIZAR'}
              </button>
            </div>
          </div>
        ))}

        {tasas.length === 0 && !loading && (
          <div className="col-span-2 text-center py-10 bg-slate-100 dark:bg-slate-800/20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No se encontraron configuraciones de divisas en la DB</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
        <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
          <strong>💡 Nota Importante:</strong> Al modificar estos valores, el precio de todos los vinilos en el catálogo (que están en USD) se recalculará instantáneamente a Pesos Argentinos para los clientes.
        </p>
      </div>
    </div>
  );
}