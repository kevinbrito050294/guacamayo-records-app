import { useState, useEffect } from 'react';
import { ConfiguracionDivisa } from '../../types/database';
import { Save, AlertCircle, Check } from 'lucide-react';

export function CurrencyManager() {
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
      const response = await fetch('http://localhost:3001/api/configuracion_divisas');
      if (!response.ok) throw new Error('Error al conectar con MySQL');
      
      const data = await response.json();
      setTasas(data || []);
    } catch (error) {
      console.error('Error loading rates:', error);
      setMessage({ type: 'error', text: 'Error al cargar las tasas de MySQL' });
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
      const response = await fetch(`http://localhost:3001/api/configuracion_divisas/${tipo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasa: nuevaTasa })
      });

      if (!response.ok) throw new Error('No se pudo actualizar en MySQL');

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
      <div className="text-center py-8">
        <div className="animate-spin text-2xl mb-2">⏳</div>
        <p>Cargando tasas de cambio...</p>
      </div>
    );
  }

  const etiquetas: { [key: string]: string } = {
    DOLAR_BLUE: 'Dólar Blue (ARS)',
    USDT: 'USDT (Cripto)',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Gestor de Tasas de Cambio (MySQL)</h2>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {tasas.map((tasa) => (
          <div
            key={tasa.id}
            className="border border-slate-200 rounded-lg p-4 flex items-end gap-4"
          >
            <div className="flex-grow">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                {etiquetas[tasa.tipo]}
              </label>
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                Última actualización: {new Date(tasa.ultima_actualizacion).toLocaleString('es-AR')}
              </p>
            </div>
            <button
              onClick={() => handleSaveTasa(tasa.tipo, tasa.tasa)}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '...' : 'Guardar'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> Los precios en el catálogo se actualizan automáticamente al cambiar estas tasas.
        </p>
      </div>
    </div>
  );
}
