import { useState, useMemo, useEffect, useRef } from 'react';
import { CarritoItem, ConfiguracionDivisa } from '../types/database';
import { Trash2, ShoppingBag, X, MessageCircle, Minus, Plus, Disc, Ticket, AlertTriangle, RotateCcw, MapPin } from 'lucide-react';
import { apiUrl } from '../lib/api';
import {
  leerCuponGuardado, guardarCupon, borrarCuponGuardado,
  validarCupon, textoBeneficio, type CuponValidado,
} from '../lib/cupon';
// El carrito se monta dentro del <CuentaProvider> (App.tsx), as?? que puede
// preguntar si hay sesi??n: de eso depende qu?? nombre y qu?? WhatsApp van a quedar
// guardados en el pedido (ver `nombreEfectivo` m??s abajo).
import { pedir, useCuenta, importeUsd, type Direccion } from '../lib/cuenta';

interface CartProps {
  items: CarritoItem[];
  onRemoveItem: (id: string) => void;
  onUpdateCantidad: (id: string, nuevaCantidad: number) => void;
  onBack: () => void;
  onClear: () => void;
  divisaPreferida?: string;
  tasas: ConfiguracionDivisa[];
  // El carrito se desmonta al volver al cat??logo, as?? que el aviso de "pedido
  // registrado" no puede vivir ac??: se lo pasa a App, que ya tiene el toast.
  onPedidoRegistrado?: (mensaje: string) => void;
}

// Lo que devuelve POST /api/pedidos cuando el pedido se registro bien.
interface RespuestaPedido {
  success?: boolean;
  numero_orden?: string;
  total_pago?: number | string | null;
  cupon?: string | null;
  descuento?: number | string | null;
}

type TonoAviso = 'error' | 'aviso';

// Los 400 de POST /api/pedidos del server (server.js) son de dos familias: los
// del cup??n (hoy uno solo, "El cup??n no es v??lido", que cubre no existe / est??
// desactivado / venci?? / agot?? sus usos) y los del inventario ("No hay stock
// suficiente del vinilo 7"). Todos mencionan la causa en el mensaje, as?? que se
// usa esa palabra para saber a cu??l se le ofrece rehacer el pedido sin cup??n.
const MENSAJE_DE_CUPON = /cup[o??]n/i;

// L??mites de POST /api/pedidos (server.js): el nombre se guarda en
// `pedidos.nombre_cliente` VARCHAR(120) y el WhatsApp en VARCHAR(32), y el server
// los recorta. Sin maxLength el cliente escribe de m??s, el server lo acota por
// su cuenta y el pedido sale con un nombre que nadie reconoce: mejor que el
// input no deje llegar ni un car??cter de m??s.
const MAX_NOMBRE = 120;
const MAX_WHATSAPP = 32;

// Aviso del 429 de POST /api/cupones/validar. Es el mismo texto en los dos
// lugares de ac?? (revalidaci??n al montar y aplicaci??n manual) para que el
// cliente lea lo mismo sin importar por d??nde entr??: el server NO dijo que el
// cup??n sea inv??lido, dijo que no lo pudo comprobar, as?? que el c??digo se
// conserva y el pedido queda bloqueado hasta resolverlo.
function avisoDeRateLimit(codigo: string, mensaje: string): { tono: TonoAviso; texto: string } {
  return {
    tono: 'aviso',
    texto: `No pudimos comprobar el cup??n ${codigo}: ${mensaje}. Lo dejamos en el carrito: comprob?? de nuevo en un rato o sacalo para pedir sin descuento.`
  };
}

export function Cart({ 
  items, 
  onRemoveItem, 
  onUpdateCantidad, 
  onBack, 
  onClear, 
  divisaPreferida = 'ARS',
  tasas,
  onPedidoRegistrado
}: CartProps) {
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  
  const [couponCode, setCouponCode] = useState('');
  const [cupon, setCupon] = useState<CuponValidado | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  // Mientras se re-valida lo que venia del localStorage, el total que se muestra
  // todavia no es el que va a cobrar el server: se muestra "comprobando", no un
  // numero que despues puede cambiar. El valor inicial sale del mismo lugar que
  // la lectura del efecto, asi no hay un frame de "comprobando" cuando no hay
  // ningun cupon guardado.
  const [comprobando, setComprobando] = useState(() => leerCuponGuardado() !== null);
  const [aviso, setAviso] = useState<{ tono: TonoAviso; texto: string } | null>(null);
  // El server rechazo el pedido por el cupon: se ofrece rehacerlo sin cupon.
  const [cuponRechazado, setCuponRechazado] = useState<{ codigo: string; error: string } | null>(null);
  // El cup??n est?? escrito pero NO se pudo comprobar (rate limit del server o
  // corte de red en la ruta de validaci??n). El c??digo se conserva ???un 429 no
  // dice que el cup??n sea inv??lido, dice que no se pudo verificar??? pero el
  // pedido queda bloqueado: mandar sin saber si el descuento entra implicar??a
  // que el server cobre un total distinto del que se le mostr?? al cliente.
  const [verificacionPendiente, setVerificacionPendiente] = useState(false);

  // --- QU?? NOMBRE Y QU?? WHATSAPP QUEDAN GUARDADOS ---
  // Con sesi??n abierta el server usa el nombre del PERFIL (anti-impersonaci??n:
  // el panel y "mis pedidos" muestran esos campos como del cliente) y el
  // WhatsApp que el cliente escriba en el form. Mostrar el valor efectivo evita
  // la sorpresa de que el pedido quede a nombre de otro.
  const { usuario } = useCuenta();
  const usuarioId = usuario?.id ?? null;
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [direccionSeleccionada, setDireccionSeleccionada] = useState<number | null>(null);
  const [cargandoDirecciones, setCargandoDirecciones] = useState(false);
  const [errorDirecciones, setErrorDirecciones] = useState('');
  const [recargaDirecciones, setRecargaDirecciones] = useState(0);
  const nombrePerfil = (usuario?.nombre ?? '').trim();
  const nombreIngresado = nombre.trim();
  // El nombre que se acaba guardando, sea invitado o cliente con sesi??n.
  const nombreEfectivo = nombrePerfil || nombreIngresado;
  // Solo se avisa cuando el input tiene algo DISTINTO al perfil: si est?? vac??o
  // (o es igual) el server va a usar el del perfil y no hay nada que explicar.
  const nombreDelPerfilGana = nombrePerfil !== '' && nombreIngresado !== '' && nombreIngresado !== nombrePerfil;
  // El WhatsApp va al rev??s que el nombre: gana lo que se escribe en el form
  // (el campo es required, as?? que nunca llega vac??o) y, si alg??n d??a dejara de
  // serlo, el tel??fono del perfil. Se muestra siempre el valor que se va a
  // guardar porque es al n??mero que el admin le escribe con los datos de pago:
  // si el cliente se equivoca, el pedido queda impagable y nadie lo avisa.
  const whatsappEfectivo = whatsapp.trim() || (usuario?.telefono ?? '').trim();

  const formularioRef = useRef<HTMLFormElement>(null);
  // Marca el pedido como "reintentar sin cup??n" despu??s de un 400 del servidor.
  // Va en un ref y no en un state porque requestSubmit() dispara el onSubmit de
  // forma s??ncrona: con state el handler todav??a leer??a el valor viejo.
  const enviarSinCuponRef = useRef(false);

  const API_BASE_URL = apiUrl();

  // Las direcciones pertenecen a la sesi??n y no deben pedirse para invitados.
  // Si fallan, el checkout sigue disponible: el env??o es opcional hasta que el
  // backend pueda persistir direccion_id.
  useEffect(() => {
    if (usuarioId === null) {
      setDirecciones([]);
      setDireccionSeleccionada(null);
      setErrorDirecciones('');
      setCargandoDirecciones(false);
      return;
    }

    let vigente = true;
    setCargandoDirecciones(true);
    setErrorDirecciones('');

    pedir<Direccion[]>('/api/direcciones').then((res) => {
      if (!vigente) return;
      if (!res.ok) {
        setErrorDirecciones(res.error);
        setDirecciones([]);
        setDireccionSeleccionada(null);
        setCargandoDirecciones(false);
        return;
      }

      const lista = Array.isArray(res.data) ? res.data : [];
      const principal = lista.find((direccion) => Number(direccion.es_default) === 1);
      setDirecciones(lista);
      setDireccionSeleccionada((actual) =>
        actual !== null && lista.some((direccion) => direccion.id === actual)
          ? actual
          : principal?.id ?? lista[0]?.id ?? null
      );
      setCargandoDirecciones(false);
    });

    return () => { vigente = false; };
  }, [usuarioId, recargaDirecciones]);

  // --- REHIDRATACI??N DEL CUP??N ---
  // El carrito se desmonta al salir de la vista, as?? que el cup??n se busca en el
  // localStorage y se vuelve a validar contra el server antes de mostrarlo.
  useEffect(() => {
    const guardado = leerCuponGuardado();
    // Si no hay nada guardado hay que apagar el "comprobando" igual: el estado
    // inicial se calcul?? con otra llamada a leerCuponGuardado() y, si entre la
    // renderizaci??n y este efecto el almacenamiento cambi?? (otra pesta??a lo
    // borr??), sin esto el bot??n de confirmar quedaba deshabilitado para siempre.
    if (!guardado) {
      setComprobando(false);
      return;
    }

    let vigente = true;
    validarCupon(guardado.codigo).then((resultado) => {
      if (!vigente) return;
      setComprobando(false);

      if (resultado.estado === 'vigente') {
        setCupon(resultado.cupon);
        setCouponCode(resultado.cupon.codigo);
        // Se refresca la foto guardada con lo que dice el server.
        guardarCupon(resultado.cupon);
        return;
      }

      // SOLO el 400 borra el cup??n: es el ??nico caso en el que el server dice
      // que el c??digo no sirve. El 429 dice que no se pudo comprobar y el corte
      // de red tampoco, as?? que en los dos el c??digo se conserva: antes un 429
      // le arrancaba el cup??n al cliente del localStorage y lo obligaba a
      // escribirlo de nuevo (lo que genera otra llamada, tambi??n throttleada).
      if (resultado.estado === 'invalido') {
        borrarCuponGuardado();
        setCupon(null);
        setCouponCode('');
        setVerificacionPendiente(false);
        setAviso({
          tono: 'error',
          texto: `El cup??n ${guardado.codigo} ya no se puede usar: ${resultado.mensaje}. Lo sacamos del carrito.`
        });
        return;
      }

      if (resultado.estado === 'muchos_intentos') {
        // No se borra y tampoco se muestra el descuento: sin comprobar, el
        // total que se pintar??a no es el que el server va a cobrar. El c??digo
        // queda escrito para que reintentar sea un click, y el pedido bloqueado
        // hasta que la validaci??n devuelva algo definitivo.
        setCupon(null);
        setCouponCode(guardado.codigo);
        setVerificacionPendiente(true);
        setAviso(avisoDeRateLimit(guardado.codigo, resultado.mensaje));
        return;
      }

      // Error de red: NO se borra lo guardado (puede ser un corte puntual) pero
      // tampoco se aplica el descuento, para no mostrar un total que el server
      // no va a cobrar. A diferencia del 429 no bloquea el pedido: sin cup??n el
      // cliente puede seguir comprando.
      setCupon(null);
      setCouponCode('');
      setVerificacionPendiente(false);
      setAviso({ tono: 'aviso', texto: `No pudimos verificar el cup??n ${guardado.codigo}: ${resultado.mensaje}. El total va sin descuento.` });
    });

    return () => { vigente = false; };
  }, []);

  // --- L??GICA DE C??LCULO LOCAL ---
  const { subtotalUsd, tasaBlue } = useMemo(() => {
    const blue = tasas.find(t => t.tipo === 'DOLAR_BLUE')?.tasa || 1;
    // `precio_venta` es DECIMAL y mysql2 lo devuelve como string: sin el
    // Number() la suma concatenar??a ("12.00" + "8.00") en vez de sumar.
    const usd = items.reduce((acc, item) => acc + (Number(item.vinilo.precio_venta) * item.cantidad), 0);
    
    return { subtotalUsd: usd, tasaBlue: blue };
  }, [items, tasas]);

  const calcularDescuento = () => {
    if (!cupon) return 0;
    if (cupon.tipo === 'porcentaje') {
      return (subtotalUsd * cupon.valor) / 100;
    }
    return cupon.valor;
  };

  const descuentoUsd = calcularDescuento();
  const totalUsd = Math.max(0, subtotalUsd - descuentoUsd);
  const totalArs = totalUsd * tasaBlue;

  const aplicarCoupon = async () => {
    if (!couponCode) return;
    setCouponLoading(true);
    setAviso(null);
    setCuponRechazado(null);
    const resultado = await validarCupon(couponCode);
    setCouponLoading(false);

    if (resultado.estado === 'vigente') {
      setCupon(resultado.cupon);
      setCouponCode(resultado.cupon.codigo);
      guardarCupon(resultado.cupon);
      setVerificacionPendiente(false);
      return;
    }

    setCupon(null);

    // 429: el c??digo se deja escrito y el pedido bloqueado. Un rate limit no
    // dice nada del cup??n, as?? que no se lo saca ni se le pide al cliente que
    // lo escriba de nuevo (eso ser??a otro request, tambi??n throttleado).
    if (resultado.estado === 'muchos_intentos') {
      setVerificacionPendiente(true);
      setAviso(avisoDeRateLimit(couponCode.trim().toUpperCase(), resultado.mensaje));
      return;
    }

    // Corte de red: se puede comprar igual, sin descuento.
    if (resultado.estado === 'sin_conexion') {
      setVerificacionPendiente(false);
      setAviso({ tono: 'aviso', texto: `No pudimos validar el cup??n: ${resultado.mensaje}. El total va sin descuento.` });
      return;
    }

    // 400: ac?? s?? sabemos que el c??digo no sirve. Solo se borra lo guardado si
    // es el mismo c??digo ???escribir uno nuevo que falla no tiene por qu?? tirar
    // el que el cliente ya ten??a en el carrito.
    if ((leerCuponGuardado()?.codigo ?? '') === couponCode.trim().toUpperCase()) borrarCuponGuardado();
    setVerificacionPendiente(false);
    setAviso({ tono: 'error', texto: `??? ${resultado.mensaje}.` });
  };

  const quitarCupon = () => {
    setCupon(null);
    setCouponCode('');
    borrarCuponGuardado();
    setAviso(null);
    setCuponRechazado(null);
    // Sacar el cup??n a mano es una de las dos salidas del estado "sin comprobar":
    // desbloquea el pedido y este sale sin descuento.
    setVerificacionPendiente(false);
  };

  // El cup??n se manda en el POST /api/pedidos solo para que el server lo vuelva
  // a validar dentro de la transacci??n del pedido.
  const enviarPedido = async (cuponUsado: CuponValidado | null) => {
    enviarSinCuponRef.current = false;
    setLoading(true);
    setAviso(null);
    setCuponRechazado(null);

    try {
      const datosPedido = {
        // Con sesi??n abierta el server ignora esto y guarda el nombre del
        // perfil (es lo que se le muestra al admin y en "mis pedidos"); sin
        // sesi??n se guarda lo que se escribi?? ac??. El `nombreEfectivo` que se
        // muestra al cliente arriba es exactamente el que gana en los dos casos.
        nombre_cliente: nombre,
        // Al rev??s que el nombre: con sesi??n, lo que el cliente escriba ac?? es
        // lo que se guarda (y adem??s queda en su perfil), y es al n??mero que el
        // admin le escribe despu??s. Si lo deja vac??o -el campo es required, as??
        // que no llega vac??o- se usa el tel??fono del perfil.
        whatsapp_cliente: whatsapp,
        // NO se manda `total_pago`: el server lo calcula contra la base dentro
        // de la transacci??n y descarta el que venga del body (server.js:289).
        // Mandarlo "por las dudas" solo abre la puerta a que alguien lea el POST
        // y crea que el precio lo pone el navegador.
        divisa_preferida: divisaPreferida,
        cupon_id: cuponUsado?.id || null,
        ...(usuario && direccionSeleccionada !== null ? { direccion_id: direccionSeleccionada } : {}),
        items: items.map(item => ({
          id: item.vinilo.id,
          cantidad: item.cantidad,
          titulo: item.vinilo.titulo
        }))
      };

      const response = await fetch(`${API_BASE_URL}/api/pedidos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosPedido)
      });

      const cuerpo: unknown = await response.json().catch(() => null);
      const mensajeError = (cuerpo as { error?: unknown } | null)?.error;
      const textoError = typeof mensajeError === 'string' && mensajeError ? mensajeError : '';

      // 429 del rate limit de POST /api/pedidos: el server corta antes de
      // abrir la transacci??n, as?? que no se registr?? nada, no se cobr?? nada y
      // el cup??n sigue intacto (guardado y en el carrito). No es un rechazo del
      // cup??n ni del carrito: es "esper?? un rato y mandalo de nuevo", y se dice
      // eso en vez de un error en rojo.
      if (response.status === 429) {
        setAviso({
          tono: 'aviso',
          texto: textoError
            ? `${textoError} No se registr?? ning??n pedido: tu carrito y tu cup??n siguen ah??.`
            : 'Hiciste demasiados pedidos en muy poco tiempo. Esper?? unos minutos y mandalo de nuevo: el carrito y el cup??n siguen ah??.'
        });
        return;
      }

      // Un 400 con cup??n NO siempre es culpa del cup??n: el server aborta el
      // pedido entero y el mismo 400 sale por falta de stock o por un vinilo
      // dado de baja. Solo los errores del cup??n lo nombran, asi que se filtra
      // por el mensaje: sin esto se le pediria al cliente que tire un cupon
      // perfectamente valido por culpa del inventario.
      if (response.status === 400 && cuponUsado && MENSAJE_DE_CUPON.test(textoError)) {
        // El server acaba de revalidar el cupon contra la base y lo rechazo, asi
        // que ya se sabe que no sirve: se saca de memoria y del almacenamiento.
        // POST /api/pedidos es todo o nada, no deja hacer el pedido sin
        // descuento, asi que se lo ofrecemos al usuario en vez de dejarlo trabado.
        setCupon(null);
        setCouponCode('');
        borrarCuponGuardado();
        setCuponRechazado({ codigo: cuponUsado.codigo, error: textoError || 'el cup??n ya no se puede usar' });
        return;
      }

      if (!response.ok) {
        throw new Error(textoError || 'No se pudo procesar el pedido');
      }

      // A partir de ac?? manda el server: el total que se confirma y el que va
      // en el mensaje de WhatsApp son los que ??l calcul?? contra la base. Van
      // por Number() porque los DECIMAL pueden llegar como string.
      const respuesta = cuerpo as RespuestaPedido;
      const totalDelServer = Number(respuesta.total_pago);
      const totalServidorUsd = Number.isFinite(totalDelServer) ? totalDelServer : totalUsd;
      const totalServidorArs = totalServidorUsd * tasaBlue;
      const descuentoServidor = Number(respuesta.descuento) || 0;
      const codigoCupon = typeof respuesta.cupon === 'string' && respuesta.cupon ? respuesta.cupon : cuponUsado?.codigo;
      const numeroOrden = respuesta.numero_orden || '?';

      const listaVinilos = items.map(i => `- ${i.cantidad}x *${i.vinilo.titulo}*`).join('\n');

      const mensajeWA = `??Hola Guacamayo Records! ????\n\n` +
        `???? *PEDIDO: #${numeroOrden}*\n` +
        // `nombreEfectivo`, no `nombre`: con sesi??n iniciada lo que queda
        // guardado es el del perfil, y el mensaje tiene que decir lo mismo que
        // va a ver el admin.
        `???? Cliente: ${nombreEfectivo}\n` +
        `???? Discos:\n${listaVinilos}\n\n` +
        (codigoCupon
          ? `??????? Cup??n: ${codigoCupon}` +
            // El server manda el descuento ya calculado en USD; el beneficio en
            // % o monto fijo solo se escribe si el navegador lo conoce.
            (descuentoServidor > 0
              ? ` (-${importeUsd(descuentoServidor)})`
              : cuponUsado ? ` (-${textoBeneficio(cuponUsado)})` : '') +
            '\n'
          : '') +
        `???? *TOTAL A PAGAR: $${Math.round(totalServidorArs).toLocaleString('es-AR')} ARS*\n` +
        `_(Ref: ${importeUsd(totalServidorUsd)})_\n\n` +
        `??Me pasan los datos para la transferencia?`;

      const telTienda = "5491164475028";
      window.open(`https://wa.me/${telTienda}?text=${encodeURIComponent(mensajeWA)}`, '_blank');

      // El uso del cup??n ya lo consumi?? el server: dejarlo guardado llevar??a al
      // pr??ximo pedido a un cup??n agotado.
      setCupon(null);
      setCouponCode('');
      borrarCuponGuardado();

      onClear();
      onBack();

      // El aviso va por callback y no por el `aviso` de este componente: dos
      // l??neas m??s abajo el carrito se desmonta (onBack vuelve al cat??logo) y un
      // setState en un componente desmontado no se ve. App ya tiene el toast.
      onPedidoRegistrado?.(
        `Pedido #${numeroOrden} registrado ?? ${importeUsd(totalServidorUsd)} (ARS ${Math.round(totalServidorArs).toLocaleString('es-AR')})` +
        (descuentoServidor > 0 ? ` ?? Cup??n ${codigoCupon} -${importeUsd(descuentoServidor)}` : '')
      );

    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      setAviso({ tono: 'error', texto: `??? ${mensaje}` });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarPedido = (e: React.FormEvent) => {
    e.preventDefault();
    // El ref (y no un state) porque requestSubmit() dispara el onSubmit de forma
    // s??ncrona: con state, el handler todav??a leer??a el `cupon` viejo.
    //
    // Si el requestSubmit() no llega a disparar el onSubmit (un `required`
    // vac??o), la marca sobrevive al pr??ximo env??o. No es un problema: para
    // entonces el cup??n ya sali?? del estado y del almacenamiento, as?? que
    // mandar sin ??l es exactamente lo que el cliente pidi?? al tocar "Pedir sin
    // cup??n". Lo que no puede pasar es al rev??s: mandar CON un cup??n que ya se
    // sabe que no sirve.
    const sinCupon = enviarSinCuponRef.current;
    enviarSinCuponRef.current = false;
    void enviarPedido(sinCupon ? null : cupon);
  };

  // Reintento sin cup??n: se limpia el cup??n y se manda el form con
  // requestSubmit() para que sigan valiendo los campos `required`.
  const reintentarSinCupon = () => {
    setCupon(null);
    setCouponCode('');
    borrarCuponGuardado();
    setVerificacionPendiente(false);
    enviarSinCuponRef.current = true;
    formularioRef.current?.requestSubmit();
  };

  return (
    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row overflow-hidden my-4 transition-all">
      <div className="flex-grow p-6 md:p-10 border-r border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-6 h-6 text-slate-950" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Tu Selecci??n</h2>
          </div>
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-center py-20 flex flex-col items-center opacity-30">
              <Disc size={48} className="animate-spin-slow mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs">El carrito est?? vac??o</p>
            </div>
          ) : (
            items.map((item) => {
              // DECIMAL que llega como string: sin el Number() el precio en
              // pesos sale concatenado en vez de multiplicado.
              const precioItemArs = Number(item.vinilo.precio_venta) * tasaBlue;
              return (
                <div key={item.vinilo.id} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-transparent dark:border-slate-800 group hover:border-amber-500/30 transition-all">
  <div className="flex gap-3 items-center">
    <img 
      src={item.vinilo.imagen_url?.split(',')[0] || ''} 
      className="h-16 w-16 object-cover rounded-2xl shadow-md flex-shrink-0" 
      alt={item.vinilo.titulo} 
    />
    <div className="flex-grow min-w-0">
      <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase leading-tight mb-1 break-words whitespace-normal">{item.vinilo.titulo}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium break-words whitespace-normal">{item.vinilo.artista}</p>
    </div>
    <button onClick={() => onRemoveItem(item.vinilo.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 flex-shrink-0 self-start">
      <Trash2 className="w-4 h-4" />
    </button>
  </div>
  <div className="flex items-center justify-between pl-1">
            <p className="text-[11px] text-amber-600 dark:text-amber-500 font-black uppercase">
            ARS ${Math.round(precioItemArs * item.cantidad).toLocaleString('es-AR')}
            </p>
            <div className="flex gap-1 flex-wrap">
    {item.vinilo.calidad && (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 uppercase tracking-wider">
        {item.vinilo.calidad}
      </span>
    )}
    {item.vinilo.pais_origen && (
      <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-500 uppercase tracking-wider">
        {item.vinilo.pais_origen}
      </span>
    )}
  </div>
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl p-1.5 shadow-sm">
              <button type="button" onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad - 1)} disabled={item.cantidad <= 1} className="p-1 hover:text-amber-500 dark:text-slate-400 disabled:opacity-20">
              <Minus size={14}/>
              </button>
              <span className="font-black text-xs w-4 text-center dark:text-white">{item.cantidad}</span>
              <button 
              type="button" 
              onClick={() => onUpdateCantidad(item.vinilo.id, item.cantidad + 1)} 
              disabled={item.cantidad >= item.vinilo.stock_actual}
              className="p-1 hover:text-amber-500 dark:text-slate-400 disabled:opacity-20"
      >
              <Plus size={14}/>
              </button>
              </div>
              </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="w-full md:w-96 bg-slate-950 text-white p-8 md:p-10 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black mb-8 text-amber-500 uppercase italic tracking-tighter">Finalizar Compra</h3>
            <div className="mb-6 space-y-2">
              <label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">Cup??n de Descuento</label>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    placeholder="Tengo un c??digo" 
                    value={couponCode} 
                    onChange={e => setCouponCode(e.target.value)}
                    disabled={!!cupon}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs focus:ring-1 focus:ring-amber-500 outline-none uppercase font-bold"
                  />
                </div>
                {cupon ? (
                  <button type="button" onClick={quitarCupon} title="Quitar el cup??n" className="bg-red-500/20 text-red-500 px-3 rounded-xl hover:bg-red-500/30 transition-all"><X size={16}/></button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => void aplicarCoupon()}
                    disabled={couponLoading || !couponCode || comprobando}
                    className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 px-4 rounded-xl text-[10px] font-black transition-all disabled:opacity-20"
                  >
                    {couponLoading ? <Disc size={14} className="animate-spin"/> : "APLICAR"}
                  </button>
                )}
              </div>
              {/* El beneficio se muestra reci??n despu??s de que el server lo confirm??. */}
              {cupon && !comprobando && (
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-wider ml-1">
                  {cupon.codigo}: -{textoBeneficio(cupon)} aplicado
                </p>
              )}
              {/* Estado "no se pudo comprobar": el c??digo sigue escrito y el bot??n
                  APLICAR es el reintento. La otra salida ???y la ??nica si el
                  cliente no quiere esperar??? es sacarlo a mano, que desbloquea el
                  pedido (este sale sin descuento). */}
              {verificacionPendiente && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-bold text-amber-400/80 normal-case leading-tight">
                    Sin comprobar: el pedido queda bloqueado hasta que se pueda validar.
                  </p>
                  <button
                    type="button"
                    onClick={quitarCupon}
                    className="shrink-0 text-[9px] font-black uppercase text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Sacar el cup??n
                  </button>
                </div>
              )}
            </div>

            {aviso && (
              <div
                role="alert"
                className={`mb-6 flex items-start gap-2 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-tight ${
                  aviso.tono === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                <AlertTriangle size={14} className="shrink-0 mt-px" />
                <span className="leading-relaxed normal-case">{aviso.texto}</span>
                <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            )}

            <form ref={formularioRef} onSubmit={handleConfirmarPedido} className="space-y-5">
              {usuario && (
                <div className="space-y-2">
                  <label htmlFor="carrito-direccion" className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">
                    <MapPin size={14} className="text-amber-500" /> Direcci??n de env??o
                  </label>
                  {cargandoDirecciones ? (
                    <p className="text-xs text-slate-400 flex items-center gap-2" role="status">
                      <Disc size={14} className="animate-spin" /> Cargando tus direcciones...
                    </p>
                  ) : errorDirecciones ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-400">
                      <span>No pudimos cargar tus direcciones: {errorDirecciones}</span>
                      <button
                        type="button"
                        onClick={() => setRecargaDirecciones((actual) => actual + 1)}
                        className="shrink-0 font-black uppercase hover:text-white"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : direcciones.length === 0 ? (
                    <p className="text-xs text-slate-400">No ten??s direcciones guardadas. Pod??s completar el pedido igual.</p>
                  ) : (
                    <select
                      id="carrito-direccion"
                      value={direccionSeleccionada ?? ''}
                      onChange={(e) => setDireccionSeleccionada(e.target.value ? Number(e.target.value) : null)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    >
                      <option value="">Eleg?? una direcci??n (opcional)</option>
                      {direcciones.map((direccion) => (
                        <option key={direccion.id} value={direccion.id}>
                          {direccion.apodo} ?? {direccion.direccion}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div>
                <input
                  id="carrito-nombre"
                  aria-label="Tu nombre"
                  aria-describedby={nombreDelPerfilGana ? 'carrito-nombre-ayuda' : undefined}
                  required placeholder="Tu Nombre" value={nombre} onChange={e => setNombre(e.target.value)}
                  maxLength={MAX_NOMBRE}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                {/* Con sesi??n abierta gana el nombre del perfil: no es un error
                    (el server lo hace a prop??sito, para que el pedido no pueda
                    quedar a nombre de otro), pero s?? tiene que estar escrito
                    antes de que el cliente apriete "enviar". */}
                {nombreDelPerfilGana && (
                  <p id="carrito-nombre-ayuda" className="mt-2 ml-1 text-[9px] font-bold text-amber-400/80 normal-case leading-relaxed">
                    Ten??s sesi??n iniciada: se va a guardar el nombre de tu perfil, ??{nombrePerfil}??.
                  </p>
                )}
              </div>
              <div>
                <input
                  id="carrito-whatsapp"
                  aria-label="Tu WhatsApp"
                  aria-describedby="carrito-whatsapp-ayuda"
                  required placeholder="WhatsApp (ej: 1164475028)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  maxLength={MAX_WHATSAPP}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-4 px-5 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                {/* El admin le escribe al n??mero que queda ac?? (y el panel tiene
                    el link de WhatsApp de cada pedido), as?? que el n??mero
                    efectivo se dice siempre, tenga sesi??n o no. */}
                <p id="carrito-whatsapp-ayuda" className="mt-2 ml-1 text-[9px] font-bold text-slate-400 normal-case leading-relaxed">
                  {whatsappEfectivo
                    ? `Se va a guardar el WhatsApp ${whatsappEfectivo}${usuario ? ' en tu cuenta' : ''}: es al que te escribimos con los datos de la transferencia.`
                    : usuario
                      ? 'A este n??mero te escribimos para pasarte los datos de la transferencia.'
                      : 'Escrib?? tu WhatsApp: es al que te escribimos para pasarte los datos de la transferencia.'}
                </p>
              </div>

              <div className="mt-10 pt-8 border-t border-white/5 space-y-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total en Pesos</span>
                  {comprobando ? (
                    <p className="text-xl font-black text-amber-500/80 italic uppercase flex items-center gap-2" role="status">
                      <Disc size={18} className="animate-spin" /> Comprobando cup??n...
                    </p>
                  ) : (
                    <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
                      ${Math.round(totalArs).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase italic">Referencia:</span>
                  {comprobando ? (
                    <span className="text-sm font-mono font-black text-slate-500">USD --.--</span>
                  ) : (
                    <span className="text-sm font-mono font-black text-amber-500/80">{importeUsd(totalUsd)}</span>
                  )}
                </div>
                {cupon && !comprobando && (
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase italic">Descuento:</span>
                    <span className="text-sm font-mono font-black text-emerald-500">-{textoBeneficio(cupon)}</span>
                  </div>
                )}
              </div>

              {/* El server arma el pedido con el descuento y sin ??l son dos pedidos
                  distintos: se dice cu??nto se paga antes de mandarlo, no despu??s. */}
              {cuponRechazado && (
                <div role="alert" className="mt-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
                  <p className="text-xs font-black uppercase text-red-400 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-px" />
                    <span className="normal-case leading-relaxed">
                      El cup??n {cuponRechazado.codigo} no se pudo aplicar: {cuponRechazado.error}. El pedido no se registr??, as?? que no se cobr?? nada.
                    </span>
                  </p>
                  <p className="text-[10px] font-bold uppercase text-slate-400 leading-relaxed">
                    Pod??s seguir adelante sin cup??n, pero el total sube a ${Math.round(subtotalUsd * tasaBlue).toLocaleString('es-AR')} ARS ({importeUsd(subtotalUsd)}).
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={reintentarSinCupon}
                      disabled={loading}
                      className="flex-1 bg-amber-500 hover:bg-white text-slate-950 py-3 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                    >
                      <RotateCcw size={14} /> Pedir sin cup??n ?? {importeUsd(subtotalUsd)}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCuponRechazado(null); setAviso({ tono: 'aviso', texto: 'Si ten??s otro c??digo, escribilo arriba. Si no, mand?? el pedido con el bot??n de abajo y va sin descuento.' }); }}
                      className="px-4 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-black text-[10px] uppercase transition-all"
                    >
                      Volver a intentar
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                // `verificacionPendiente` bloquea el env??o: el cup??n est??
                // escrito pero sin comprobar, y mandarlo as?? mostrar??a un total
                // sin descuento que el server s?? aplicar??a (o al rev??s). Se
                // desbloquea comprob??ndolo de nuevo o sac??ndolo a mano.
                disabled={loading || comprobando || verificacionPendiente}
                className="w-full mt-8 bg-amber-500 hover:bg-white text-slate-950 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading || comprobando
                  ? <Disc size={20} className="animate-spin" />
                  : verificacionPendiente
                    ? <AlertTriangle size={20} />
                    : <MessageCircle size={20} />}
                {loading
                  ? "PROCESANDO..."
                  : comprobando
                    ? "COMPROBANDO CUP??N..."
                    : verificacionPendiente
                      ? "COMPROB?? EL CUP??N DE NUEVO"
                      : "ENVIAR PEDIDO"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
