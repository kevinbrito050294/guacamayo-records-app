import { useState, useEffect, useCallback, useRef } from 'react';
import { Catalog } from './components/Catalog';
import { Cart } from './components/Cart';
import { AdminPanel } from './components/AdminPanel';
import { CurrencySelector } from './components/CurrencySelector';
import { CarritoItem, ViniloCatalogo, ConfiguracionDivisa } from './types/database';
import { ShoppingCart, Disc, Moon, Sun, LogOut, User, UserPlus } from 'lucide-react';
import { AdminLogin } from './components/AdminLogin';
import { apiUrl } from './lib/api';
import { useCuenta } from './lib/cuenta';
import { CuentaProvider } from './components/cuenta/CuentaProvider';
import { Acceso } from './components/cuenta/Acceso';
import { Recuperacion } from './components/cuenta/Recuperacion';
import { CuentaPanel } from './components/cuenta/CuentaPanel';
import { Aviso } from './components/cuenta/ui';

import logoImg from './assets/logo.webp';

type Page = 'catalog' | 'cart' | 'admin' | 'cuenta' | 'recuperar';
type Divisa = 'USD' | 'ARS' | 'USDT';
type AdminCredentialMetadata = { id: string; email: string; nombre: string; lastUsed: number };

function App() {
  return (
    <CuentaProvider>
      <AppShell />
    </CuentaProvider>
  );
}

function AppShell() {
  const { usuario, cargando: cargandoCuenta, idsFavoritos, alternarFavorito } = useCuenta();
  const esModoAdmin = new URLSearchParams(window.location.search).get('admin') === '1';
  const parametrosIniciales = new URLSearchParams(window.location.search);
  const esRutaRecuperacion = window.location.pathname === '/restablecer-contrasena';
  const esRecuperacionInicial = esRutaRecuperacion || parametrosIniciales.get('recuperar') === '1';
  const tokenRecuperacion = esRecuperacionInicial ? parametrosIniciales.get('token') || undefined : undefined;

  const [currentPage, setCurrentPage] = useState<Page>(() => (
    esModoAdmin ? 'admin' : esRecuperacionInicial ? 'recuperar' : 'catalog'
  ));
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [vinilos, setVinilos] = useState<ViniloCatalogo[]>([]);
  const [tasas, setTasas] = useState<ConfiguracionDivisa[]>([]);
  const [loading, setLoading] = useState(!esRecuperacionInicial);
  const [catalogoError, setCatalogoError] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginCargando, setLoginCargando] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [divisa, setDivisa] = useState<Divisa>('ARS');
  const [aviso, setAviso] = useState('');
  const [modoAcceso, setModoAcceso] = useState<'login' | 'registro'>('login');
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentialMetadata[]>([]);
  const navegacionDesdeHistorial = useRef(false);

  const getApiUrl = useCallback(() => apiUrl(), []);

  useEffect(() => {
    const paginaValida = (valor: unknown): valor is Page =>
      valor === 'catalog' || valor === 'cart' || valor === 'admin' || valor === 'cuenta' || valor === 'recuperar';
    const paginaInicial = currentPage;
    window.history.replaceState({ ...(window.history.state || {}), page: paginaInicial }, '', window.location.href);
    // Deja una entrada gemela para que el primer Atrás vuelva al estado actual
    // y no saque al usuario de la web por un toque accidental.
    window.history.pushState({ page: paginaInicial }, '', window.location.href);
    const alVolver = (event: PopStateEvent) => {
      const pagina = paginaValida(event.state?.page) ? event.state.page : 'catalog';
      navegacionDesdeHistorial.current = true;
      setCurrentPage(pagina);
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  useEffect(() => {
    if (navegacionDesdeHistorial.current) {
      navegacionDesdeHistorial.current = false;
      return;
    }
    if (window.history.state?.page === currentPage) return;
    window.history.pushState({ page: currentPage }, '', window.location.href);
  }, [currentPage]);

  const cargarDatosIniciales = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      setLoading(true);
      setCatalogoError('');
      const [resVinilos, resTasas] = await Promise.all([
        fetch(`${getApiUrl()}/api/vinilos`, { signal: controller.signal }),
        fetch(`${getApiUrl()}/api/configuracion_divisas`, { signal: controller.signal })
      ]);

      if (!resVinilos.ok || !resTasas.ok) throw new Error('Error en la conexión');

      const dataVinilos = await resVinilos.json();
      const dataTasas = await resTasas.json();

      setVinilos(Array.isArray(dataVinilos) ? dataVinilos : []);
      setTasas(Array.isArray(dataTasas) ? dataTasas : (dataTasas.tasas || []));

    } catch (error) {
      console.error("❌ Error:", error);
      setCatalogoError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'La carga del catálogo tardó demasiado. Podés reintentar.'
          : 'No se pudo cargar el catálogo y las divisas. Podés reintentar.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [getApiUrl]);

  useEffect(() => {
    if (!esRecuperacionInicial) void cargarDatosIniciales();
  }, [cargarDatosIniciales, esRecuperacionInicial]);

  useEffect(() => {
    if (!esModoAdmin) return;
    let vigente = true;
    fetch(`${getApiUrl()}/api/admin/yo`, { credentials: 'include' })
      .then(res => {
        if (!vigente) return;
        setIsAdminAuthenticated(res.ok);
      })
      .catch(() => {
        // Android puede estar ejecutando el autologin biométrico mientras el
        // WebView termina de restaurar la cookie; no mostrar error durante esa
        // ventana para no competir con el formulario automático.
      });
    return () => { vigente = false; };
  }, [esModoAdmin, getApiUrl]);

  useEffect(() => {
    if (esRecuperacionInicial) return;
    const actualizarDisponibilidad = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/vinilos`);
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (Array.isArray(data)) setVinilos(data as ViniloCatalogo[]);
      } catch {
        // La vista actual se conserva y se reintenta en el próximo intervalo.
      }
    };
    const intervalo = setInterval(() => void actualizarDisponibilidad(), 20000);
    return () => clearInterval(intervalo);
  }, [esRecuperacionInicial, getApiUrl]);

  // --- SESIÓN ADMIN: la cookie httpOnly no se puede leer desde JS, así que al
  // --- montar preguntamos al servidor si todavía hay sesión abierta.
  useEffect(() => {
    let vigente = true;
    fetch(`${getApiUrl()}/api/admin/yo`, { credentials: 'include' })
      .then(res => { if (vigente) setIsAdminAuthenticated(res.ok); })
      .catch(() => { if (vigente) setIsAdminAuthenticated(false); });
    return () => { vigente = false; };
  }, [getApiUrl]);

  // --- LOGOUT ---
  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${getApiUrl()}/api/admin/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) { 
      console.error("Error al notificar logout al server:", err); 
    } finally {
      setIsAdminAuthenticated(false);
      // El cierre del panel no debe dejar al usuario dentro del catálogo ni
      // conservar una vista administrativa: siempre vuelve al login admin.
      setCurrentPage('admin');
      setLoginError('');
      // En Android el WebView puede conservar una ruta previa; forzar la URL
      // admin evita que una navegación externa termine en el catálogo.
      window.location.replace('/?admin=1');
    }
  }, [getApiUrl]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // --- LOGIN ADMIN (email + contraseña contra la BD) ---
  const handleAdminLogin = useCallback(async (email: string, password: string) => {
    try {
      setLoginCargando(true);
      const res = await fetch(`${getApiUrl()}/api/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const admin = data.admin;
        const adminId = admin?.id == null ? '' : String(admin.id);
        const canonicalEmail = (typeof admin?.email === 'string' ? admin.email : email)
          .trim().toLowerCase();
        const adminName = typeof admin?.nombre === 'string' ? admin.nombre.trim() : '';
        if (adminId) {
          window.AndroidBiometric?.saveAdminCredentials(adminId, canonicalEmail, adminName, password);
          setAdminCredentials(previous => [
            ...previous.filter(credential => credential.id !== adminId),
            { id: adminId, email: canonicalEmail, nombre: adminName, lastUsed: Date.now() }
          ]);
        }
        window.AndroidBiometric?.registerPushToken();
        setIsAdminAuthenticated(true);
        setLoginError('');
        return;
      }
      if (res.status === 401) {
        setLoginError(data.error || 'Email o contraseña incorrectos.');
        return;
      }
      if (res.status === 403) {
        setLoginError(data.error || 'No tenés permisos para acceder al panel.');
        return;
      }
      // Se conserva para compatibilidad con servidores antiguos.
      if (res.status === 423) {
        setLoginError(data.message || 'El servidor todavía limita esta cuenta a una sesión.');
        return;
      }
      setLoginError(data.error || 'No se pudo iniciar sesión');
    } catch {
      setLoginError('Servidor no disponible');
    } finally {
      setLoginCargando(false);
    }
  }, [getApiUrl]);

  useEffect(() => {
    const bridge = window.AndroidBiometric;
    if (!bridge) return;
    try {
      const metadata = JSON.parse(bridge.listAdminCredentials()) as unknown;
      if (Array.isArray(metadata)) setAdminCredentials(metadata as AdminCredentialMetadata[]);
    } catch {
      setAdminCredentials([]);
    }
  }, []);

  const alternarFavoritoCatalogo = useCallback(async (viniloId: string) => {
    if (!usuario) {
      setCurrentPage('cuenta');
      return;
    }
    const res = await alternarFavorito(Number(viniloId));
    if (!res.ok) setAviso(res.error);
  }, [usuario, alternarFavorito]);

  // Los avisos son tipo toast: se van solos, sin alert().
  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const handleAddToCart = (vinilo: ViniloCatalogo) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.vinilo.id === vinilo.id);
      if (existe && existe.cantidad >= (vinilo.stock_actual || 0)) return prev;
      if (existe) {
        return prev.map(item => item.vinilo.id === vinilo.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { vinilo, cantidad: 1 }];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans">
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          
          <div
            className={`flex items-center gap-2 shrink-0 ${esModoAdmin ? '' : 'cursor-pointer'}`}
            onClick={() => { if (!esModoAdmin) { setCurrentPage('catalog'); cargarDatosIniciales(); } }}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 overflow-hidden rounded-full border border-slate-100 dark:border-slate-700">
              <img src={logoImg} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none min-w-0">
              <span className="text-sm sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter truncate">GUACAMAYO</span>
              <span className="text-[7px] sm:text-[9px] font-bold text-amber-500 uppercase tracking-widest">Records</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {!esModoAdmin && (
              <div className="w-[68px] sm:w-[140px]">
                <CurrencySelector divisaActual={divisa} onDivisaChange={setDivisa} />
              </div>
            )}
            
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 sm:p-2 text-slate-500 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              {isDarkMode ? <Sun size={18} className="sm:w-5 sm:h-5" /> : <Moon size={18} className="sm:w-5 sm:h-5" />}
            </button>

            {!esModoAdmin && (
              <button onClick={() => setCurrentPage('cart')} className="relative p-1.5 sm:p-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
                {carrito.length > 0 && (
                  <span className="absolute top-0 right-0 bg-amber-500 text-[8px] font-black w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center rounded-full border border-white dark:border-slate-900 animate-in zoom-in">
                    {carrito.length}
                  </span>
                )}
              </button>
            )}

             {!esModoAdmin && usuario ? (
               <button
                 type="button"
                 onClick={() => setCurrentPage('cuenta')}
                 disabled={cargandoCuenta}
                 className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
               >
                 {cargandoCuenta ? <Disc size={16} className="animate-spin" /> : <User size={16} />}
                 <span className="hidden sm:inline">Mi cuenta</span>
               </button>
             ) : !esModoAdmin ? (
               <div className="flex items-center gap-1">
                 <button
                   type="button"
                   onClick={() => { setModoAcceso('login'); setCurrentPage('cuenta'); }}
                   disabled={cargandoCuenta}
                   aria-label="Ingresar"
                   title="Ingresar"
                   className="inline-flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                 >
                   <User size={18} />
                   <span className="hidden sm:inline">Ingresar</span>
                 </button>
                 <button
                   type="button"
                   onClick={() => { setModoAcceso('registro'); setCurrentPage('cuenta'); }}
                   disabled={cargandoCuenta}
                   aria-label="Crear cuenta"
                   title="Crear cuenta"
                   className="inline-flex items-center gap-2 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider hover:bg-amber-400 transition-colors disabled:opacity-40"
                 >
                   <UserPlus size={18} />
                   <span className="hidden sm:inline">Crear cuenta</span>
                 </button>
               </div>
             ) : null}

          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4">
         {catalogoError && currentPage !== 'recuperar' && (
           <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
             <span>{catalogoError}</span>
             <button
               type="button"
               onClick={() => void cargarDatosIniciales()}
               className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700"
             >
               REINTENTAR
             </button>
           </div>
         )}

         {loading && currentPage !== 'recuperar' && !esModoAdmin ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Disc className="w-12 h-12 text-amber-500 animate-spin mb-4 opacity-20" />
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Cargando...</p>
          </div>
        ) : (
          <div className="w-full">
            {currentPage === 'catalog' && (
              <Catalog
                vinilos={vinilos}
                onAddToCart={handleAddToCart}
                divisaActiva={divisa}
                carrito={carrito}
                tasas={tasas}
                idsFavoritos={idsFavoritos}
                onToggleFavorito={alternarFavoritoCatalogo}
              />
            )}
            
            {currentPage === 'cart' && (
              <Cart 
                items={carrito} 
                onRemoveItem={(id) => setCarrito(prev => prev.filter(i => i.vinilo.id !== id))} 
                onUpdateCantidad={(id, cant) => setCarrito(prev => prev.map(i => i.vinilo.id === id ? {...i, cantidad: cant} : i))} 
                onBack={() => setCurrentPage('catalog')} 
                onClear={() => setCarrito([])} 
                divisaPreferida={divisa} 
                tasas={tasas} 
                // El carrito se desmonta al volver al catálogo, así que el aviso
                // de "pedido registrado" se muestra con el toast que ya vive acá.
                onPedidoRegistrado={setAviso}
              />
            )}

            {currentPage === 'admin' && (
              <div className="space-y-4">
                {isAdminAuthenticated ? (
                  <>
                    <div className="flex justify-between items-center bg-amber-500/10 p-3 rounded-2xl mb-6">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest px-2">Panel Administrativo</span>
                      <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-transform active:scale-95 flex items-center gap-2">
                        <LogOut size={16} /> SALIR
                      </button>
                    </div>
                    <AdminPanel onBack={handleLogout} />
                  </>
                ) : (
                  <>
                    <AdminLogin onLogin={handleAdminLogin} error={loginError} cargando={loginCargando} />
                    {adminCredentials.length > 1 && (
                      <div className="mx-auto -mt-12 mb-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Cambiar cuenta biométrica</p>
                        <div className="space-y-2">
                          {adminCredentials.map(credential => (
                            <button key={credential.id} type="button" onClick={() => window.AndroidBiometric?.selectAdmin(credential.id)} className="block w-full rounded-xl bg-slate-50 px-3 py-2 text-left text-sm dark:bg-slate-950 dark:text-white">
                              <strong>{credential.nombre || credential.email}</strong>
                              {credential.nombre && <span className="ml-2 text-slate-500">{credential.email}</span>}
                            </button>
                          ))}
                        </div>
                        <p className="mt-3 text-[10px] text-slate-500">Elegí una cuenta para el próximo desbloqueo biométrico o ingresá sus credenciales manualmente.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {currentPage === 'cuenta' && (
              usuario ? (
                <CuentaPanel
                  onVolver={() => setCurrentPage('catalog')}
                  divisa={divisa}
                  tasas={tasas}
                />
              ) : (
                <Acceso
                  key={modoAcceso}
                  modoInicial={modoAcceso}
                  onVolver={() => setCurrentPage('catalog')}
                  onAccesoAdmin={() => setCurrentPage('admin')}
                  onOlvidePassword={() => setCurrentPage('recuperar')}
                />
              )
            )}

            {currentPage === 'recuperar' && (
              <Recuperacion
                token={tokenRecuperacion}
                onVolverLogin={() => { setModoAcceso('login'); setCurrentPage('cuenta'); }}
                onRestablecida={() => {
                   const url = new URL(window.location.href);
                   url.searchParams.delete('token');
                   url.searchParams.delete('recuperar');
                   url.pathname = '/';
                   window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
                }}
              />
            )}
          </div>
        )}
      </div>

      {aviso && <Aviso mensaje={aviso} onCerrar={() => setAviso('')} />}
    </div>
  );
}

export default App;
