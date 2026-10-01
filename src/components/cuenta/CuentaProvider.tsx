import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CuentaContext, pedir,
  type Favorito, type ResultadoAccion, type Usuario, type ValorCuenta,
  type DatosLogin, type DatosRegistro,
} from '../../lib/cuenta';

const MINUTOS_INACTIVIDAD = 15;
const MILIS_INACTIVIDAD = MINUTOS_INACTIVIDAD * 60 * 1000;

/**
 * Estado global de la cuenta del cliente.
 *
 * Al montar pregunta al server si hay sesion (la cookie es httpOnly) y, si la
 * hay, trae tambien los favoritos para que el catalogo ya muestre los corazones
 * marcados en la primera pintada.
 */
export function CuentaProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [idsFavoritos, setIdsFavoritos] = useState<Set<number>>(new Set());
  const temporizadorInactividad = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refrescarFavoritos = useCallback(async (): Promise<ResultadoAccion> => {
    const res = await pedir<Favorito[]>('/api/favoritos');
    if (res.ok && Array.isArray(res.data)) {
      setFavoritos(res.data);
      setIdsFavoritos(new Set(res.data.map((f) => Number(f.vinilo_id))));
    }
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, error: '' };
  }, []);

  const refresh = useCallback(async () => {
    const res = await pedir<{ usuario: Usuario }>('/api/auth/yo');
    const actual = res.ok && res.data ? res.data.usuario : null;
    setUsuario(actual);
    if (actual) {
      void refrescarFavoritos();
    } else {
      setFavoritos([]);
      setIdsFavoritos(new Set());
    }
    return actual;
  }, [refrescarFavoritos]);

  useEffect(() => {
    const iniciar = async () => {
      await refresh();
      setCargando(false);
    };
    void iniciar();
  }, [refresh]);

  // El server ya dejo la cookie; los favoritos se recargan para pintar los corazones.
  const sesionIniciada = useCallback(async (nuevo: Usuario): Promise<ResultadoAccion> => {
    setUsuario(nuevo);
    await refrescarFavoritos();
    return { ok: true, error: '' };
  }, [refrescarFavoritos]);

  const login = useCallback(async (datos: DatosLogin) => {
    const res = await pedir<{ usuario: Usuario }>('/api/auth/login', { method: 'POST', cuerpo: datos });
    if (!res.ok || !res.data?.usuario) return { ok: false, error: res.error };
    return sesionIniciada(res.data.usuario);
  }, [sesionIniciada]);

  const registro = useCallback(async (datos: DatosRegistro) => {
    const res = await pedir<{ usuario: Usuario }>('/api/auth/registro', { method: 'POST', cuerpo: datos });
    if (!res.ok || !res.data?.usuario) return { ok: false, error: res.error };
    return sesionIniciada(res.data.usuario);
  }, [sesionIniciada]);

  const loginConGoogle = useCallback(async (idToken: string) => {
    const res = await pedir<{ usuario: Usuario }>('/api/auth/google', { method: 'POST', cuerpo: { id_token: idToken } });
    if (!res.ok || !res.data?.usuario) return { ok: false, error: res.error };
    return sesionIniciada(res.data.usuario);
  }, [sesionIniciada]);

  const logout = useCallback(async () => {
    await pedir('/api/auth/logout', { method: 'POST' });
    setUsuario(null);
    setFavoritos([]);
    setIdsFavoritos(new Set());
  }, []);

  // El navegador cierra la sesión aunque el usuario no haga otra petición.
  // El servidor aplica el mismo límite para que la cookie no siga siendo válida.
  useEffect(() => {
    if (!usuario) return;

    const reiniciarTemporizador = () => {
      if (temporizadorInactividad.current) clearTimeout(temporizadorInactividad.current);
      temporizadorInactividad.current = setTimeout(() => { void logout(); }, MILIS_INACTIVIDAD);
    };
    const eventos = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    eventos.forEach((evento) => window.addEventListener(evento, reiniciarTemporizador, { passive: true }));
    reiniciarTemporizador();

    return () => {
      if (temporizadorInactividad.current) clearTimeout(temporizadorInactividad.current);
      eventos.forEach((evento) => window.removeEventListener(evento, reiniciarTemporizador));
    };
  }, [usuario, logout]);

  const alternarFavorito = useCallback(async (viniloId: number): Promise<ResultadoAccion> => {
    const id = Number(viniloId);
    if (!usuario) return { ok: false, error: 'Iniciá sesión para guardar favoritos' };
    if (!Number.isFinite(id)) return { ok: false, error: 'Vinilo inválido' };

    const estaba = idsFavoritos.has(id);
    const res = await pedir(`/api/favoritos/${id}`, { method: estaba ? 'DELETE' : 'POST' });
    if (!res.ok) return { ok: false, error: res.error };

    if (estaba) {
      setIdsFavoritos((prev) => {
        const siguiente = new Set(prev);
        siguiente.delete(id);
        return siguiente;
      });
      setFavoritos((prev) => prev.filter((f) => Number(f.vinilo_id) !== id));
    } else {
      // El alta sí necesita los datos del vinilo (precio, imagen), asi que se recurre la lista.
      setIdsFavoritos((prev) => new Set(prev).add(id));
      void refrescarFavoritos();
    }
    return { ok: true, error: '' };
  }, [usuario, idsFavoritos, refrescarFavoritos]);

  const vaciarFavoritos = useCallback(async (): Promise<ResultadoAccion> => {
    const ids = Array.from(idsFavoritos);
    const resultados = await Promise.all(ids.map((id) => pedir(`/api/favoritos/${id}`, { method: 'DELETE' })));
    if (resultados.every((r) => r.ok)) {
      setFavoritos([]);
      setIdsFavoritos(new Set());
      return { ok: true, error: '' };
    }
    void refrescarFavoritos();
    return { ok: false, error: 'No se pudieron quitar todos los favoritos' };
  }, [idsFavoritos, refrescarFavoritos]);

  const valor: ValorCuenta = {
    usuario,
    cargando,
    login,
    registro,
    loginConGoogle,
    logout,
    refresh,
    favoritos,
    idsFavoritos,
    alternarFavorito,
    refrescarFavoritos,
    vaciarFavoritos,
  };

  return <CuentaContext.Provider value={valor}>{children}</CuentaContext.Provider>;
}
