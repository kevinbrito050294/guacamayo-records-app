import React, { useState } from 'react';
import { CalidadVinilo } from '../../types/database';
import { Save, AlertCircle, Check, Disc, Music, Tag, Hash, DollarSign, Database, AlignLeft } from 'lucide-react';

interface VinylFormProps {
  onSuccess?: () => void;
}

const GENEROS = [
  'Rock', 'Jazz', 'Electrónica', 'Hip-Hop', 'Pop', 'Clásica', 
  'Funk', 'Soul', 'Latin', 'Reggae', 'Indie', 'Experimental', 'Otro',
];

const CALIDADES: CalidadVinilo[] = ['NM', 'EX', 'VG+', 'VG', 'G'];

export function VinylForm({ onSuccess }: VinylFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    titulo: '',
    artista: '',
    genero: 'Rock',
    pais_origen: '',
    precio_venta: '',
    stock_actual: '',
    calidad: 'VG' as CalidadVinilo,
    imagen_url: '',
    descripcion: '',
  });

  const getApiUrl = () => {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3001' 
      : `${window.location.protocol}//${window.location.host.replace(':5173', ':3001')}`;
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.codigo || !formData.titulo || !formData.artista || !formData.precio_venta) {
      setMessage({ type: 'error', text: 'Completa los campos requeridos' });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/api/vinilos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          precio_venta: parseFloat(formData.precio_venta),
          stock_actual: parseInt(formData.stock_actual) || 0,
        }),
      });

      if (!response.ok) throw new Error('Error al guardar');

      setMessage({ type: 'success', text: 'Vinilo agregado correctamente' });
      setFormData({
        codigo: '', titulo: '', artista: '', genero: 'Rock',
        pais_origen: '',
        precio_venta: '', stock_actual: '', calidad: 'VG',
        imagen_url: '', descripcion: '',
      });

      setTimeout(() => {
        setMessage(null);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión con el servidor' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl p-8 border border-slate-100 dark:border-slate-800 transition-colors">
      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8 italic uppercase tracking-tighter">
        AGREGAR <span className="text-amber-500">NUEVO VINILO</span>
      </h2>

      {message && (
        <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm uppercase tracking-tight">{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* CÓDIGO SKU */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Código (SKU)</label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
              <input
                type="text" required value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all"
                placeholder="LP-001"
              />
            </div>
          </div>

          {/* ARTISTA */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Artista / Banda</label>
            <div className="relative">
              <Music className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
              <input
                type="text" required value={formData.artista}
                onChange={(e) => setFormData({ ...formData, artista: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all"
                placeholder="The Beatles"
              />
            </div>
          </div>

          {/* TÍTULO */}
          <div className="md:col-span-2 relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Título del Álbum</label>
            <div className="relative">
              <Disc className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
              <input
                type="text" required value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all"
                placeholder="Abbey Road"
              />
            </div>
          </div>

          {/* GÉNERO - INTEGRADO CON 'TAG' */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Género</label>
            <div className="relative">
              <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
              <select
                value={formData.genero}
                onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white appearance-none cursor-pointer"
              >
                {GENEROS.map((gen) => <option key={gen} value={gen}>{gen}</option>)}
              </select>
            </div>
          </div>
          {/* PAÍS DE ORIGEN */}
<div className="relative">
  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">País de Origen</label>
  <div className="relative">
    <Disc className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
    <input
      type="text" value={formData.pais_origen}
      onChange={(e) => setFormData({ ...formData, pais_origen: e.target.value })}
      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all"
      placeholder="Ej: UK, USA, ARG"
    />
  </div>
</div>

          {/* CALIDAD */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Calidad</label>
            <div className="relative">
              <Check className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
              <select
                value={formData.calidad}
                onChange={(e) => setFormData({ ...formData, calidad: e.target.value as CalidadVinilo })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white appearance-none cursor-pointer"
              >
                {CALIDADES.map((cal) => <option key={cal} value={cal}>{cal}</option>)}
              </select>
            </div>
          </div>

          {/* PRECIO Y STOCK */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Precio (USD)</label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4" />
              <input
                type="number" step="0.01" required value={formData.precio_venta}
                onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all font-bold"
                placeholder="25.00"
              />
            </div>
          </div>

          <div className="relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Stock inicial</label>
            <div className="relative">
              <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 w-4 h-4" />
              <input
                type="number" value={formData.stock_actual}
                onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all font-bold"
                placeholder="1"
              />
            </div>
          </div>
          
          {/* DESCRIPCIÓN */}
          <div className="md:col-span-2 relative">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 ml-2 uppercase tracking-widest mb-2 block">Descripción / Detalles</label>
            <div className="relative">
              <AlignLeft className="absolute left-4 top-4 text-amber-500 w-4 h-4" />
              <textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                rows={3}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border-none rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white transition-all"
                placeholder="Ej: Primera edición, incluye póster original..."
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 py-5 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all shadow-xl shadow-amber-500/10 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Sincronizar con Catálogo
            </>
          )}
        </button>
      </form>
    </div>
  );
}