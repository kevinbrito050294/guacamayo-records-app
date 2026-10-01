import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react';
import { pedir, type Direccion } from '../../lib/cuenta';
import { Cargando, Campo, MensajeError, Vacio } from './ui';

const FORM_VACIO = { apodo: '', direccion: '', ciudad: '', provincia: '', codigo_postal: '', es_default: false };
type FormDireccion = typeof FORM_VACIO;

// MySQL devuelve TINYINT en es_default, no boolean.
const esPrincipal = (d: Direccion) => Number(d.es_default) === 1;

// DEUDA VISIBLE (no implementada a propósito): la dirección que se guarda acá
// NO viaja al pedido. `POST /api/pedidos` (server.js) no recibe `direccion_id`
// y la tabla `pedidos` no guarda ningún snapshot de envío, así que no hay
// trazabilidad de a dónde se manda cada pedido: hoy el admin le pide la
// dirección al cliente por WhatsApp (el mensaje del checkout cierra en "¿Me
// pasan los datos para la transferencia?"), y cuando se confirma el pedido el
// panel muestra el WhatsApp para buscarla. Esta pantalla existe porque el
// envío real (migración + server + enganche en el checkout) está pendiente;
// mientras tanto guarda direcciones "para tenerlas", no para que se usen en la
// compra.

export function Direcciones() {
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorForm, setErrorForm] = useState('');

  const [form, setForm] = useState<FormDireccion>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    const res = await pedir<Direccion[]>('/api/direcciones');
    if (!res.ok) setError(res.error);
    else setDirecciones(Array.isArray(res.data) ? res.data : []);
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const editar = (direccion: Direccion) => {
    setEditandoId(direccion.id);
    setErrorForm('');
    setForm({
      apodo: direccion.apodo || '',
      direccion: direccion.direccion || '',
      ciudad: direccion.ciudad || '',
      provincia: direccion.provincia || '',
      codigo_postal: direccion.codigo_postal || '',
      es_default: esPrincipal(direccion),
    });
    // En el celu el form queda lejos del botón: lo subimos a la vista.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setErrorForm('');
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    setErrorForm('');

    if (form.apodo.trim().length === 0 || form.direccion.trim().length === 0) {
      setErrorForm('El apodo y la dirección son obligatorios');
      return;
    }

    setGuardando(true);
    const cuerpo = {
      apodo: form.apodo.trim(),
      direccion: form.direccion.trim(),
      ciudad: form.ciudad.trim(),
      provincia: form.provincia.trim(),
      codigo_postal: form.codigo_postal.trim(),
      es_default: form.es_default,
    };
    const res = editandoId
      ? await pedir<Direccion>(`/api/direcciones/${editandoId}`, { method: 'PUT', cuerpo })
      : await pedir<Direccion>('/api/direcciones', { method: 'POST', cuerpo });

    setGuardando(false);
    if (!res.ok) {
      setErrorForm(res.error);
      return;
    }
    cancelarEdicion();
    await cargar();
  };

  const eliminar = async (direccion: Direccion) => {
    if (!confirm(`¿Eliminar la dirección "${direccion.apodo}"?`)) return;
    const res = await pedir(`/api/direcciones/${direccion.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (editandoId === direccion.id) cancelarEdicion();
    await cargar();
  };

  const marcarPrincipal = async (direccion: Direccion) => {
    const res = await pedir<Direccion>(`/api/direcciones/${direccion.id}`, {
      method: 'PUT',
      cuerpo: { es_default: true },
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await cargar();
  };

  const cambiarCampo = (campo: keyof FormDireccion, valor: string | boolean) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  return (
    <div className="space-y-6">
      <form onSubmit={guardar} className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">
            <MapPin size={18} className="text-amber-500" />
            {editandoId ? 'Editar dirección' : 'Nueva dirección'}
          </h3>
          {editandoId && (
            <button
              type="button"
              onClick={cancelarEdicion}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="dir-apodo" etiqueta="Apodo" valor={form.apodo} onChange={(v) => cambiarCampo('apodo', v)} placeholder="Casa" maxLength={60} required />
          <Campo id="dir-cp" etiqueta="Código postal" valor={form.codigo_postal} onChange={(v) => cambiarCampo('codigo_postal', v)} placeholder="1425" maxLength={20} />
        </div>

        <Campo
          id="dir-linea"
          etiqueta="Dirección"
          valor={form.direccion}
          onChange={(v) => cambiarCampo('direccion', v)}
          placeholder="Calle y número, piso/depto"
          maxLength={255}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="dir-ciudad" etiqueta="Ciudad" valor={form.ciudad} onChange={(v) => cambiarCampo('ciudad', v)} placeholder="CABA" maxLength={120} />
          <Campo id="dir-provincia" etiqueta="Provincia" valor={form.provincia} onChange={(v) => cambiarCampo('provincia', v)} placeholder="Buenos Aires" maxLength={120} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="dir-default"
            type="checkbox"
            checked={form.es_default}
            onChange={(e) => cambiarCampo('es_default', e.target.checked)}
            className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
          />
          <label htmlFor="dir-default" className="text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            Usar como dirección principal
          </label>
        </div>

        {errorForm && <MensajeError mensaje={errorForm} />}

        <button
          type="submit"
          disabled={guardando}
          className="w-full sm:w-auto bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 dark:hover:bg-white transition-all active:scale-95 disabled:opacity-60"
        >
          {guardando ? 'GUARDANDO...' : editandoId ? 'GUARDAR CAMBIOS' : 'AGREGAR DIRECCIÓN'}
        </button>
      </form>

      {cargando ? (
        <Cargando texto="Cargando direcciones..." />
      ) : error ? (
        <MensajeError mensaje={error} onReintentar={cargar} />
      ) : direcciones.length === 0 ? (
        <Vacio icono={<MapPin size={40} />} titulo="Sin direcciones" texto="Cargá una arriba para tenerla lista cuando hagas un pedido." />
      ) : (
        <div className="space-y-3">
          {direcciones.map((direccion) => (
            <article key={direccion.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{direccion.apodo}</p>
                  {esPrincipal(direccion) && (
                    <span className="text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest bg-amber-500 text-slate-950">Principal</span>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">{direccion.direccion}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {[direccion.ciudad, direccion.provincia, direccion.codigo_postal].filter(Boolean).join(' · ') || 'Sin ciudad ni CP'}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!esPrincipal(direccion) && (
                  <button
                    type="button"
                    onClick={() => marcarPrincipal(direccion)}
                    aria-label={`Usar ${direccion.apodo} como principal`}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                  >
                    <Star size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => editar(direccion)}
                  aria-label={`Editar ${direccion.apodo}`}
                  className="p-2 text-slate-400 hover:text-amber-500 transition-colors"
                >
                  <Pencil size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(direccion)}
                  aria-label={`Eliminar ${direccion.apodo}`}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
