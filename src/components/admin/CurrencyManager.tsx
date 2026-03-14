import { useState, useEffect } from 'react';
import { ConfiguracionDivisa } from '../../types/database';
import { Save, AlertCircle, Check, TrendingUp, Clock } from 'lucide-react';

interface CurrencyManagerProps {
  getApiUrl: () => string;
}

export function CurrencyManager({ getApiUrl }: CurrencyManagerProps) {
  const [tasas, setTasas] = useState<ConfiguracionDivisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    cargarTasas();
  }, []);

  async function cargarTasas() {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/api/configuracion_divisas`);
      
      if (!response.ok) throw new Error('Error al conectar con el servidor');
      
      const data = await response.json();

      // Forzamos que data sea un array para evitar errores de renderizado
      if (Array.isArray(data)) {
        setTasas(data);
      } else {
        console.error('La API no devolvió un array:', data);
        setTasas([]);
      }
    } catch (error) {
      console.error('Error loading rates:', error);
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

      setMessage({ type: 'success', text: `Tasa ${tipo.replace('_', ' ')} actualizada correctamente` });
      
      // Limpiamos el mensaje después de 3 segundos
      setTimeout(() => setMessage(null), 3000);
      
      // Recargamos para ver la fecha de actualización nueva
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
        <p className="font-mono text-[10px] tracking-widest uppercase font-black">Sincronizando divisas...</p>
      </div>
    );
  }

  const etiquetas: { [key: string]: string } = {
    DOLAR_BLUE: 'Dólar Blue (ARS)',
    USDT: 'USDT (P2P Binance)',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500 rounded-xl text-slate-950 shadow-lg shadow-amber-500/20">
          <TrendingUp size={20} />
        </div>
        <div>
          <h2 className="text-xl font-black dark:text-white uppercase tracking-tighter italic">Gestor de Divisas</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Control de cotizaciones</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 transition-all animate-in fade-in zoom-in duration-300 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}
        >
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-xs font-black uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {tasas.map((tasa) => (
          <div
            key={tasa.id}
            className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 transition-all"
          >
            <div className="mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                {etiquetas[tasa.tipo] || tasa.tipo.replace('_', ' ')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-black text-lg">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={tasa.tasa}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTasas(prev => prev.map(t => 
                      t.id === tasa.id ? { ...t, tasa: isNaN(val) ? 0 : val } : t
                    ));
                  }}
                  className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-amber-500 dark:text-white font-mono text-2xl font-black transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock size={12} className="text-amber-500" />
                <span className="text-[9px] uppercase font-black tracking-tighter">
                  Actualizado: {tasa.ultima_actualizacion ? new Date(tasa.ultima_actualizacion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}
                </span>
              </div>
              
              <button
                onClick={() => handleSaveTasa(tasa.tipo, tasa.tasa)}
                disabled={saving}
                className="bg-slate-900 dark:bg-amber-500 hover:scale-105 disabled:opacity-50 text-white dark:text-slate-950 px-6 py-3 rounded-xl flex items-center gap-2 font-black text-[10px] tracking-widest transition-all shadow-lg active:scale-95"
              >
                <Save className="w-4 h-4" />
                {saving ? '...' : 'ACTUALIZAR'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 bg-slate-900 dark:bg-slate-800/80 rounded-3xl border-l-4 border-amber-500 shadow-xl">
        <p className="text-[11px] text-slate-300 leading-relaxed font-medium uppercase tracking-tight">
          <strong className="text-amber-500">⚠️ ATENCIÓN:</strong> El cambio en estas tasas afecta globalmente el precio en pesos (ARS) de todo el catálogo. Asegúrate de que los valores sean correctos antes de actualizar.
        </p>
      </div>
    </div>
  );
}