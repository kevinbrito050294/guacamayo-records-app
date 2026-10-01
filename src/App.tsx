import { useState, useEffect, useCallback } from 'react';
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
import { CuentaPanel } from './components/cuenta/CuentaPanel';
import { Aviso } from './components/cuenta/ui';

import logoImg from './assets/logo.webp';

type Page = 'catalog' | 'cart' | 'admin' | 'cuenta';
type Divisa = 'USD' | 'ARS' | 'USDT';

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

  const [currentPage, setCurrentPage] = useState<Page>(() => (
    esModoAdmin ? 'admin' : 'catalog'
  ));
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [vinilos, setVinilos] = useState<ViniloCatalogo[]>([]);
  const [tasas, setTasas] = useState<ConfiguracionDivisa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [loginCargando, setLoginCargando] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [divisa, setDivisa] = useState<Divisa>('ARS');
  const [aviso, setAviso] = useState('');
  const [modoAcceso, setModoAcceso] = useState<'login' | 'registro'>('login');

  const getApiUrl = useCallback(() => apiUrl(), []);

  const cargarDatosIniciales = useCallback(async () => {
    try {
      setLoading(true);
      const [resVinilos, resTasas] = await Promise.all([
        fetch(`${getApiUrl()}/api/vinilos`),
        fetch(`${getApiUrl()}/api/configuracion_divisas`)
      ]);

      if (!resVinilos.ok || !resTasas.ok) throw new Error('Error en la conexión');

      const dataVinilos = await resVinilos.json();
      const dataTasas = await resTasas.json();

      setVinilos(Array.isArray(dataVinilos) ? dataVinilos : []);
      setTasas(Array.isArray(dataTasas) ? dataTasas : (dataTasas.tasas || []));

    } catch (error) {
      console.error("❌ Error:", error);
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  useEffect(() => {
    cargarDatosIniciales();
  }, [cargarDatosIniciales]);

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
      setCurrentPage('catalog');
      setLoginError('');
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
        setIsAdminAuthenticated(true);
        setLoginError('');
        return;
      }
      // 423: el panel ya está abierto en otro dispositivo (sesión única).
      if (res.status === 423) {
        setLoginError(data.message || 'El panel ya está abierto en otro dispositivo.');
        return;
      }
      setLoginError(data.error || 'No se pudo iniciar sesión');
    } catch {
      setLoginError('Servidor no disponible');
    } finally {
      setLoginCargando(false);
    }
  }, [getApiUrl]);

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
        {loading ? (
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
                  <AdminLogin onLogin={handleAdminLogin} error={loginError} cargando={loginCargando} />
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
                />
              )
            )}
          </div>
        )}
      </div>

      {aviso && <Aviso mensaje={aviso} onCerrar={() => setAviso('')} />}
    </div>
  );
}

export default App;
