import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomBytes, createSign } from 'crypto';
import 'dotenv/config';
import { crearAuthRouter, middlewaresAuth, limpiarSesionesVencidas, purgarIntentos } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Railway/Node corre detras de un proxy: sin esto req.ip es el del proxy y
// las sesiones/auditoria registrarian siempre la misma IP.
app.set('trust proxy', 1);

// --- CORS con credenciales ---
// Las cookies de sesion viajan en httpOnly, asi que el navegador solo las manda
// si el fetch usa credentials:'include' y el servidor responde con
// Access-Control-Allow-Origin concreto (junto con '*' el navegador lo bloquea).
const ORIGENES_WEB = (
    process.env.ALLOWED_ORIGINS
    || 'http://localhost:5173,http://localhost:3000,http://localhost:3001,https://guacamayorecords.up.railway.app,https://guacamayorecords.com,https://www.guacamayorecords.com'
).split(',').map(o => o.trim()).filter(Boolean);
// Capacitor puede servir la interfaz desde un origen local o cargar la URL remota
// configurada en capacitor.config.ts. Son orígenes fijos, no comodines: la app
// sigue usando cookies con credenciales y el CSRF de abajo continúa rechazando
// cualquier otro origen.
const ORIGENES_CAPACITOR = [
    'https://localhost',
    'http://localhost',
    'http://localhost:8080',
    'capacitor://localhost',
    'ionic://localhost',
    'https://www.guacamayorecords.com'
];
const ORIGENES_PERMITIDOS = [...new Set([...ORIGENES_WEB, ...ORIGENES_CAPACITOR])];
const esOrigenLocalCapacitor = (origin) => /^(https?|capacitor|ionic):\/\/localhost(?::\d+)?$/.test(origin);

app.use(cors({
    origin: (origin, callback) => {
        // Sin origin = same-origin o curl/postman: se deja pasar.
        if (!origin || ORIGENES_PERMITIDOS.includes(origin) || esOrigenLocalCapacitor(origin)) return callback(null, true);
        callback(null, false);
    },
    credentials: true
}));
app.use(express.json());

// --- CSRF: la cookie de sesión es SameSite=Lax, que frena el cross-site pero no
// --- el cross-ORIGEN entre dos hosts del mismo dominio. Acá se cae el pedido si
// --- viene de un origen que no está en la lista y además el método escribe.
app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const origin = req.headers.origin;
    if (origin && !ORIGENES_PERMITIDOS.includes(origin) && !esOrigenLocalCapacitor(origin)) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }
    next();
});

// --- CONFIGURACIÓN DE IMÁGENES ---
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));
app.get('/android-update.json', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'android-update.json'), err => {
        if (err) next(err);
    });
});
app.get('/android-update-nuevo.json', (req, res, next) => {
    res.sendFile(path.join(__dirname, 'android-update-nuevo.json'), err => {
        if (err) next(err);
    });
});
app.use(express.static(path.join(__dirname, 'dist')));

// --- CONEXIÓN DB (RAILWAY) ---
const db = mysql.createPool(process.env.MYSQL_URL);
// Wrapper de promesas del MISMO pool (no una conexión extra). Lo usan los
// handlers que necesitan transacciones o varios await seguidos: pedidos y
// cupones. El resto de las rutas sigue con db.query() en callbacks.
const sql = db.promise();

// Un solo watcher para todos los navegadores evita abrir un polling de base de
// datos por cliente. SSE notifica el cambio y cada interfaz vuelve a pedir el
// estado completo, manteniendo una sola fuente de verdad en MySQL.
const catalogoSseClients = new Set();
let firmaCatalogoAnterior = '';

async function firmaCatalogo() {
    const [vinilos] = await sql.query(`
        SELECT COUNT(*) AS total, COALESCE(MAX(id), 0) AS max_id,
               COALESCE(MAX(version), 0) AS max_version,
               COALESCE(MAX(UNIX_TIMESTAMP(ultima_modificacion_en)), 0) AS ultima_modificacion
          FROM inventario_vinilos
    `);
    const [divisas] = await sql.query(`
        SELECT COUNT(*) AS total,
               COALESCE(MAX(UNIX_TIMESTAMP(ultima_actualizacion)), 0) AS ultima_actualizacion,
               COALESCE(SUM(tasa), 0) AS suma_tasas
          FROM configuracion_divisas
         WHERE tipo IN (?, ?)
    `, TIPOS_DIVISA);
    return JSON.stringify({ vinilos: vinilos[0], divisas: divisas[0] });
}

function emitirCambioCatalogo(firma) {
    for (const cliente of catalogoSseClients) {
        cliente.write(`event: catalogo-cambio\ndata: ${firma}\n\n`);
    }
}

async function revisarCambiosCatalogo() {
    try {
        const firma = await firmaCatalogo();
        if (!firmaCatalogoAnterior) {
            firmaCatalogoAnterior = firma;
            return;
        }
        if (firma !== firmaCatalogoAnterior) {
            firmaCatalogoAnterior = firma;
            emitirCambioCatalogo(firma);
        }
    } catch {
        // Un fallo transitorio no debe cerrar el proceso ni las conexiones SSE.
    }
}

setInterval(revisarCambiosCatalogo, 2000).unref();

app.get('/api/catalogo-eventos', async (req, res, next) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        res.write('retry: 3000\n\n');
        catalogoSseClients.add(res);
        req.on('close', () => catalogoSseClients.delete(res));
    } catch (error) {
        next(error);
    }
});

setInterval(() => {
    for (const cliente of catalogoSseClients) cliente.write(': keep-alive\n\n');
}, 25_000).unref();

let firebaseTokenCache = null;

function firebaseServiceAccount() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    try {
        const account = JSON.parse(raw);
        return account.project_id && account.client_email && account.private_key ? account : null;
    } catch (error) {
        console.error('FIREBASE_SERVICE_ACCOUNT_JSON no es JSON válido:', error.message);
        return null;
    }
}

async function firebaseAccessToken(account) {
    if (firebaseTokenCache && firebaseTokenCache.expiresAt > Date.now() + 60_000) return firebaseTokenCache.token;
    const now = Math.floor(Date.now() / 1000);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'RS256', typ: 'JWT' });
    const claims = encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key, 'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
    });
    if (!response.ok) throw new Error(`OAuth Firebase respondió ${response.status}`);
    const data = await response.json();
    firebaseTokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return firebaseTokenCache.token;
}

async function notificarNuevoPedido({ idPedido, numeroOrden, nombreCliente }) {
    const account = firebaseServiceAccount();
    if (!account) return;
    const [tokens] = await sql.query('SELECT `id`, `token` FROM `admin_push_tokens` WHERE `activo` = 1');
    if (tokens.length === 0) return;
    const accessToken = await firebaseAccessToken(account);
    await Promise.all(tokens.map(async fila => {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: {
                token: fila.token,
                notification: { title: 'Nuevo pedido recibido', body: `${numeroOrden || `#${idPedido}`} · ${nombreCliente || 'Cliente invitado'}` },
                data: { tipo: 'pedido_nuevo', pedido_id: String(idPedido) },
                android: { priority: 'high', notification: { channel_id: 'pedidos', sound: 'default' } },
            } }),
        });
        if (response.ok) return;
        const body = await response.text();
        if (response.status === 404 || body.includes('UNREGISTERED') || body.includes('INVALID_ARGUMENT')) {
            await sql.query('DELETE FROM `admin_push_tokens` WHERE `id` = ?', [fila.id]);
        } else {
            console.error(`FCM no pudo enviar al token ${fila.id}: HTTP ${response.status}`);
        }
    }));
}

// ==========================================
// 0. AUTENTICACIÓN (ver auth.js)
// ==========================================
// Login/logout/heartbeat, cuentas de cliente, direcciones y favoritos.
app.use('/api', crearAuthRouter(db));

// Middlewares para proteger las rutas del backoffice que viven mas abajo.
const { requiereAdmin, requireAdminRole, requiereCliente, sesionClienteOpcional } = middlewaresAuth(db);
const requiereAdminMaximo = requireAdminRole('admin');

app.post('/api/admin/push-token', requiereAdmin, async (req, res, next) => {
    try {
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
        if (!token || token.length > 512) return res.status(400).json({ error: 'Token de notificaciones no válido' });
        await sql.query(
            `INSERT INTO \`admin_push_tokens\` (\`admin_usuario_id\`, \`token\`, \`plataforma\`, \`activo\`, \`ultimo_registro\`)
             VALUES (?, ?, 'android', 1, NOW())
             ON DUPLICATE KEY UPDATE \`admin_usuario_id\` = VALUES(\`admin_usuario_id\`), \`activo\` = 1, \`ultimo_registro\` = NOW()`,
            [req.auth.admin.id, token]
        );
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Limpieza periodica: sesiones vencidas, contadores de intentos de login y
// ventanas de los rate limits por IP. Las dos ultimas son funciones declaradas
// mas abajo (por eso van en un interval y no al pie de su seccion).
setInterval(() => {
    purgarIntentos();
    purgarRateLimitsPorIP();
    limpiarSesionesVencidas(db)
        .then(borradas => { if (borradas > 0) console.log(`🧹 ${borradas} sesion(es) vencida(s) eliminada(s)`); })
        .catch(err => console.error('Error limpiando sesiones:', err.message));
}, 60 * 60 * 1000).unref();

// ==========================================
// RATE LIMIT POR IP (compartido por cupones y pedidos)
// ==========================================
// POR QUE UN SOLO MECANISMO Y NO UNO POR RUTA
//   Las dos rutas publicas sin sesion que un atacante puede golpear en boucle
//   ("probar un cupón" y "mandar un pedido") necesitan exactamente el mismo
//   throttle, asi que el mecanismo vive UNA vez aca: Map en memoria por IP,
//   ventana fija y 429 al pasarse. Es el mismo criterio que usa el login en
//   auth.js y no agrega ninguna dependencia. Cada ruta se instancia con sus
//   numeros y su texto, que viven junto a la ruta que los usa (el de pedidos en
//   la seccion 3, el de cupones en la seccion 4).
//
//   Es por proceso, no compartido entre instancias: frena el sondeo trivial, no
//   un ataque distribuido. La IP sale de `req.ip`, que ya viene real porque
//   arriba esta `trust proxy`.
//
//   POR QUE VIVE ACA Y NO EN SU SECCION
//   Cada ruta se registra con su middleware mientras se carga el modulo. Si el
//   `const` de cada uno viviera mas abajo (en su seccion), la expresion de
//   `app.post(...)` lo leeria en TDZ y el server no ni siquiera levantaria.

/** Techo de IPs vivas por rate limit: rotar IP no puede inflar los Maps. */
const MAX_CLAVES_RATE_LIMIT = 5000;
// Todos los limitadores creados, para que `purgarRateLimitsPorIP` (lo llama el
// interval de mas arriba) no tenga que conocer nombres de variables.
const RATE_LIMITS_POR_IP = [];

/**
 * Rate limit por IP de ventana fija.
 *
 * @param {object} opciones
 * @param {number}  opciones.max         pedidos/intentos por IP y por ventana
 * @param {number}  opciones.ventanaMs   duracion de la ventana
 * @param {string}  opciones.texto429    mensaje EXACTO del 429 (el frontend lo
 *   matchea para distinguir "esperá" de "tu cupón no sirve", asi que el texto
 *   es parte del contrato y no se toca sin avisar)
 * @param {boolean} [opciones.soloFallos] si es true, la cuota se consume
 *   SOLO en el camino de error: el middleware abre la ventana pero no cuenta, y
 *   el handler llama a `contarFallo` cuando la validación falla. Ver el
 *   `soloFallos` de /api/cupones/validar para el porqué.
 * @returns {{ middleware: Function, contarFallo: Function, purgar: Function }}
 */
function crearRateLimitPorIP({ max, ventanaMs, texto429, soloFallos = false }) {
    // Una ventana por IP: { count, hasta }. En memoria, como el Map de intentos
    // de login de auth.js.
    const ventanas = new Map();

    const ipDe = (req) => (req.ip || req.socket?.remoteAddress || '').slice(0, 45);

    /** Ventana abierta de esta IP, creandola si no habia (o si ya vencio). */
    const ventanaDe = (ip, ahora) => {
        const previa = ventanas.get(ip);
        if (previa && ahora <= previa.hasta) return previa;
        if (ventanas.size >= MAX_CLAVES_RATE_LIMIT) {
            // Se descarta la mas vieja en vez de crecer sin limite.
            const [masVieja] = ventanas.keys();
            ventanas.delete(masVieja);
        }
        const registro = { count: 0, hasta: ahora + ventanaMs };
        ventanas.set(ip, registro);
        return registro;
    };

    /** Suma un uso y responde 429 si se paso el techo. Devuelve si respondio. */
    const sumarYResponder = (registro, res) => {
        registro.count += 1;
        if (registro.count <= max) return false;
        res.status(429).json({ error: texto429 });
        return true;
    };

    const middleware = (req, res, next) => {
        const registro = ventanaDe(ipDe(req), Date.now());
        if (!soloFallos && sumarYResponder(registro, res)) return;
        // Queda en req para que `contarFallo` encuentre la MISMA ventana y no
        // tenga que volver a buscar la IP.
        req.ventanaRateLimit = registro;
        next();
    };

    // Solo tiene sentido con `soloFallos`: es el unico lugar donde la cuota se
    // gasta, asi que el acierto no la consume nunca.
    const contarFallo = (req, res) => {
        if (!req.ventanaRateLimit) return false;
        return sumarYResponder(req.ventanaRateLimit, res);
    };

    const purgar = () => {
        const ahora = Date.now();
        for (const [ip, registro] of ventanas) {
            if (ahora > registro.hasta) ventanas.delete(ip);
        }
    };

    RATE_LIMITS_POR_IP.push({ purgar });
    return { middleware, contarFallo, purgar };
}

/** Barro de ventanas vencidas de todos los rate limits. */
function purgarRateLimitsPorIP() {
    for (const limitador of RATE_LIMITS_POR_IP) limitador.purgar();
}

// ==========================================
// 1. GESTIÓN DE DIVISAS
// ==========================================
// La migración de modo 2 agrega a configuracion_divisas: modo, fuente,
// ultima_sincronizacion, estado, error_sincronizacion y sync_slot. `sync_slot` es la
// marca persistente que evita que dos procesos hagan la misma sincronización.
// BINANCE_SYNC_HOURS acepta HH:mm separados por coma; por defecto son 09:00 y
// 21:00. BINANCE_SYNC_TIMEZONE por defecto es America/Argentina/Buenos_Aires.
const TIPOS_DIVISA = ['DOLAR_BLUE', 'USDT'];
const BINANCE_SYMBOL = 'USDTARS';
// api1 mantiene el mismo endpoint oficial y evita el bloqueo geografico que
// devuelve api.binance.com desde algunas regiones de Railway.
const BINANCE_API_URLS = (process.env.BINANCE_API_URLS || [
    process.env.BINANCE_API_URL,
    'https://data-api.binance.vision/api/v3/ticker/price',
    'https://api1.binance.com/api/v3/ticker/price',
    'https://api2.binance.com/api/v3/ticker/price',
    'https://api.binance.com/api/v3/ticker/price',
].filter(Boolean).join(','))
    .split(',')
    .map(url => url.trim())
    .filter(Boolean);
const BINANCE_SYNC_TIMEOUT_MS = 8000;
const BINANCE_SYNC_HOURS_CONFIGURADAS = (process.env.BINANCE_SYNC_HOURS || '09:00,21:00')
    .split(',')
    .map(hora => hora.trim())
    .filter(hora => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
    .sort();
const BINANCE_SYNC_HOURS = BINANCE_SYNC_HOURS_CONFIGURADAS.length > 0
    ? [...new Set(BINANCE_SYNC_HOURS_CONFIGURADAS)]
    : ['09:00', '21:00'];
const BINANCE_SYNC_TIMEZONE = process.env.BINANCE_SYNC_TIMEZONE || 'America/Argentina/Buenos_Aires';
let sincronizacionBinanceEnCurso = null;

const filaDivisaPublica = fila => ({
    tipo: fila.tipo,
    tasa: fila.tasa,
    modo: fila.modo,
    fuente: fila.fuente,
    ultima_sincronizacion: fila.ultima_sincronizacion,
    estado: fila.estado
});

function horaLocalBinance() {
    let partes;
    try {
        partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: BINANCE_SYNC_TIMEZONE,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date()).reduce((resultado, parte) => {
            if (parte.type !== 'literal') resultado[parte.type] = parte.value;
            return resultado;
        }, {});
    } catch (error) {
        console.error('Zona horaria invalida para Binance:', error.message);
        return null;
    }
    const hora = `${partes.hour}:${partes.minute}`;
    const programada = BINANCE_SYNC_HOURS.filter(valor => valor <= hora).pop();
    return programada ? `${partes.year}-${partes.month}-${partes.day}T${programada}` : null;
}

async function obtenerTasaBinance() {
    const errores = [];
    for (const baseUrl of BINANCE_API_URLS) {
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), BINANCE_SYNC_TIMEOUT_MS);
        try {
            const url = new URL(baseUrl);
            url.searchParams.set('symbol', BINANCE_SYMBOL);
            const respuesta = await fetch(url, { signal: controlador.signal });
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const datos = await respuesta.json();
            const tasa = Number(datos?.price);
            if (datos?.symbol !== BINANCE_SYMBOL || !Number.isFinite(tasa) || tasa <= 0) {
                throw new Error('respuesta invalida');
            }
            return { tasa, fuente: baseUrl };
        } catch (error) {
            errores.push(`${baseUrl}: ${error.message}`);
        } finally {
            clearTimeout(temporizador);
        }
    }
    throw new Error(`Binance no disponible (${errores.join('; ')})`);
}

async function marcarErrorBinance(mensaje) {
    try {
        await sql.query(
            `UPDATE configuracion_divisas
                SET estado = 'error', fuente = 'binance', error_sincronizacion = ?
              WHERE tipo IN (?, ?)`,
            [String(mensaje).slice(0, 500), ...TIPOS_DIVISA]
        );
    } catch (error) {
        console.error('No se pudo registrar el error de Binance:', error.message);
    }
}

async function reclamarSlotBinance(slot) {
    const conexion = await db.promise().getConnection();
    try {
        await conexion.beginTransaction();
        const [filas] = await conexion.query(
            'SELECT tipo, sync_slot FROM configuracion_divisas WHERE tipo IN (?, ?) FOR UPDATE',
            TIPOS_DIVISA
        );
        if (filas.length !== TIPOS_DIVISA.length || filas.some(fila => fila.sync_slot === slot)) {
            await conexion.rollback();
            return false;
        }
        await conexion.query(
            `UPDATE configuracion_divisas
                SET sync_slot = ?, estado = 'sincronizando', error_sincronizacion = NULL
              WHERE tipo IN (?, ?)`,
            [slot, ...TIPOS_DIVISA]
        );
        await conexion.commit();
        return true;
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function guardarTasaBinance(tasa) {
    const conexion = await db.promise().getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.query(
            `UPDATE configuracion_divisas
                SET tasa = ?, modo = 'binance', fuente = 'binance',
                    ultima_sincronizacion = NOW(), ultima_actualizacion = NOW(),
                    estado = 'activo', error_sincronizacion = NULL
              WHERE tipo IN (?, ?)`,
            [tasa, ...TIPOS_DIVISA]
        );
        await conexion.commit();
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function sincronizarBinance({ slot = null, forzar = false } = {}) {
    if (sincronizacionBinanceEnCurso) return sincronizacionBinanceEnCurso;
    sincronizacionBinanceEnCurso = (async () => {
        if (!forzar && !(await reclamarSlotBinance(slot))) return { omitida: true };
        try {
            const resultado = await obtenerTasaBinance();
            await guardarTasaBinance(resultado.tasa);
            return resultado;
        } catch (error) {
            await marcarErrorBinance(error.message);
            throw error;
        }
    })();
    try {
        return await sincronizacionBinanceEnCurso;
    } finally {
        sincronizacionBinanceEnCurso = null;
    }
}

// GET es publico: devuelve solo el contrato necesario para el catalogo y el
// estado operativo. Nunca expone updated_by, errores internos ni configuración.
app.get('/api/configuracion_divisas', async (req, res, next) => {
    try {
        const [filas] = await sql.query(
            `SELECT tipo, tasa, modo, fuente, ultima_sincronizacion, estado
               FROM configuracion_divisas WHERE tipo IN (?, ?) ORDER BY tipo`,
            TIPOS_DIVISA
        );
        res.json(filas.map(filaDivisaPublica));
    } catch (error) {
        next(error);
    }
});

app.put('/api/configuracion_divisas/:tipo', requiereAdminMaximo, async (req, res, next) => {
    try {
        const { tipo } = req.params;
        const { tasa } = req.body || {};
        if (!TIPOS_DIVISA.includes(tipo)) return res.status(400).json({ error: 'Tipo de divisa invalido' });
        if (typeof tasa !== 'number' || !Number.isFinite(tasa) || tasa <= 0) {
            return res.status(400).json({ error: 'La tasa debe ser un numero finito mayor que cero' });
        }
        const [resultado] = await sql.query(
            `UPDATE configuracion_divisas
                SET tasa = ?, modo = 'manual', fuente = 'manual',
                    ultima_actualizacion = NOW(), estado = 'activo', error_sincronizacion = NULL
              WHERE tipo = ?`,
            [tasa, tipo]
        );
        if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Divisa no encontrada' });
        res.json({ success: true, tipo, tasa, modo: 'manual', fuente: 'manual' });
    } catch (error) {
        next(error);
    }
});

app.post('/api/configuracion_divisas/sincronizar-binance', requiereAdminMaximo, async (req, res, next) => {
    try {
        const resultado = await sincronizarBinance({ forzar: true });
        if (resultado.omitida) return res.status(409).json({ error: 'Ya hay una sincronizacion en curso' });
        res.json({ success: true, fuente: 'binance', tasa: resultado.tasa });
    } catch (error) {
        res.status(502).json({ error: 'No se pudo sincronizar Binance' });
    }
});

async function revisarSincronizacionBinance() {
    const slot = horaLocalBinance();
    if (!slot) return;
    try {
        await sincronizarBinance({ slot });
    } catch (error) {
        console.error('Error en sincronizacion programada de Binance:', error.message);
    }
}

// Revisa cada minuto; el slot se guarda en DB, por lo que no duplica entre
// reinicios ni entre instancias. No se ejecuta como consecuencia de un GET.
setInterval(revisarSincronizacionBinance, 60 * 1000).unref();
revisarSincronizacionBinance().catch(error => console.error('Error iniciando scheduler Binance:', error.message));

// ==========================================
// 2. GESTIÓN DE VINILOS
// ==========================================
// GET es publico (catalogo). Todo lo que escribe es solo backoffice.
const ALIAS_ADMIN_INVENTARIO = {
    'guacamayorecords.info@gmail.com': 'Hoffer Tabares',
    'kevinbrito5553@gmail.com': 'Kevin Brito',
};

function responsableInventario(req) {
    const admin = req.auth?.admin || {};
    const email = String(admin.email || '').trim().toLowerCase();
    return {
        id: Number.isInteger(Number(admin.id)) ? Number(admin.id) : null,
        email: email || null,
        nombre: ALIAS_ADMIN_INVENTARIO[email] || String(admin.nombre || email || 'Administrador').trim(),
    };
}

function datosCodigo(codigo) {
    const texto = String(codigo || '').trim();
    const match = /^(.*?)(\d+)$/.exec(texto);
    if (!match) return null;
    return { prefijo: match[1], numero: Number(match[2]), ancho: match[2].length };
}

async function siguienteCodigoInventario(conn) {
    const [filas] = await conn.query('SELECT codigo FROM inventario_vinilos WHERE codigo IS NOT NULL');
    const datos = filas.map(fila => datosCodigo(fila.codigo)).filter(Boolean);
    const grupos = new Map();
    for (const dato of datos) {
        const clave = `${dato.prefijo}\u0000${dato.ancho}`;
        const grupo = grupos.get(clave) || { ...dato, cantidad: 0 };
        grupo.cantidad += 1;
        grupos.set(clave, grupo);
    }
    const patron = Array.from(grupos.values()).sort((a, b) => b.cantidad - a.cantidad || b.numero - a.numero)[0]
        || { prefijo: 'VIN', ancho: 3 };
    const usados = new Set(datos.filter(dato => dato.prefijo === patron.prefijo).map(dato => dato.numero));
    let numero = 1;
    while (usados.has(numero)) numero += 1;
    return `${patron.prefijo}${String(numero).padStart(patron.ancho, '0')}`;
}

async function crearViniloDesdeCompra(req, res, next) {
    const compraItemId = Number(req.body?.compra_item_id);
    const cantidadRecibida = Number(req.body?.cantidad_recibida ?? req.body?.stock_actual);
    if (!Number.isInteger(compraItemId) || compraItemId < 1) return res.status(400).json({ error: 'compra_item_id invalido' });
    if (!Number.isInteger(cantidadRecibida) || cantidadRecibida < 1) return res.status(400).json({ error: 'cantidad_recibida invalida' });

    let conn;
    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();
        const [items] = await conn.query('SELECT * FROM compra_items WHERE id = ? FOR UPDATE', [compraItemId]);
        if (items.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Item de compra no encontrado' });
        }
        const item = items[0];
        const pendiente = Number(item.cantidad_comprada) - Number(item.cantidad_recibida);
        if (cantidadRecibida > pendiente) {
            await conn.rollback();
            return res.status(400).json({ error: `Solo quedan ${pendiente} unidades por recibir` });
        }

        const lock = await conn.query("SELECT GET_LOCK('guacamayo:inventario:codigo', 10) AS adquirido");
        if (!Number(lock[0][0].adquirido)) {
            await conn.rollback();
            return res.status(409).json({ error: 'No se pudo reservar un codigo de inventario. Intentá de nuevo.' });
        }
        try {
            const codigo = await siguienteCodigoInventario(conn);
            const responsable = responsableInventario(req);
            const precioVenta = Number(req.body.precio_venta || 0);
            if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
                await conn.rollback();
                return res.status(400).json({ error: 'El precio de venta debe ser mayor que cero' });
            }
            const [resultado] = await conn.query(
                `INSERT INTO inventario_vinilos
                    (codigo, titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, pais_origen, descripcion,
                     ultima_modificacion_en, ultima_modificacion_admin_id, ultima_modificacion_admin_email, ultima_modificacion_admin_nombre)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
                [codigo, req.body.titulo || item.titulo, req.body.artista || item.artista, precioVenta, cantidadRecibida,
                    req.body.imagen_url || item.imagen_url, req.body.genero || item.genero, req.body.calidad || item.calidad,
                    req.body.pais_origen || item.pais_origen, req.body.descripcion || item.descripcion,
                    responsable.id, responsable.email, responsable.nombre]
            );
            const nuevaCantidad = Number(item.cantidad_recibida) + cantidadRecibida;
            const estado = nuevaCantidad >= Number(item.cantidad_comprada) ? 'incorporado_inventario' : 'recibido_parcial';
            await conn.query('UPDATE compra_items SET cantidad_recibida = ?, vinilo_id = ?, estado = ? WHERE id = ?', [nuevaCantidad, resultado.insertId, estado, compraItemId]);
            await conn.query('UPDATE compras c JOIN (SELECT compra_id, SUM(estado = \'incorporado_inventario\') AS completos, COUNT(*) AS total FROM compra_items WHERE compra_id = ? GROUP BY compra_id) x ON x.compra_id = c.id SET c.estado = IF(x.completos = x.total, \'recibida\', \'recibida_parcial\') WHERE c.id = ?', [item.compra_id, item.compra_id]);
            await conn.commit();
            res.json({ success: true, id: resultado.insertId, codigo, cantidad_recibida: cantidadRecibida });
        } finally {
            await conn.query("SELECT RELEASE_LOCK('guacamayo:inventario:codigo')").catch(() => {});
        }
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        next(error);
    } finally {
        if (conn) conn.release();
    }
}

app.get('/api/admin/compras', requiereAdmin, async (req, res, next) => {
    try {
        const [compras] = await sql.query(
            `SELECT c.*, a.nombre AS responsable_nombre
               FROM compras c LEFT JOIN admin_usuarios a ON a.id = c.responsable_admin_id
              ORDER BY c.id DESC`
        );
        const [items] = await sql.query('SELECT * FROM compra_items ORDER BY id ASC');
        const porCompra = new Map();
        for (const item of items) {
            const lista = porCompra.get(Number(item.compra_id)) || [];
            lista.push(item);
            porCompra.set(Number(item.compra_id), lista);
        }
        res.json(compras.map(compra => ({ ...compra, items: porCompra.get(Number(compra.id)) || [] })));
    } catch (error) {
        next(error);
    }
});

app.post('/api/admin/compras', requiereAdmin, async (req, res, next) => {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!String(body.proveedor || '').trim() || items.length === 0) return res.status(400).json({ error: 'Proveedor e items son obligatorios' });
    const tasaArsUsdt = Number(body.tasa_ars_usdt || 0);
    const tasaVesUsdt = Number(body.tasa_ves_usdt || 0);
    if (!Number.isFinite(tasaArsUsdt) || tasaArsUsdt <= 0 || !Number.isFinite(tasaVesUsdt) || tasaVesUsdt <= 0) return res.status(400).json({ error: 'Las tasas ARS/USDT y VES/USDT deben ser mayores que cero' });
    for (const item of items) {
        if (!String(item.titulo || '').trim() || !String(item.artista || '').trim()) return res.status(400).json({ error: 'Cada item necesita titulo y artista' });
        if (!Number.isInteger(Number(item.cantidad_comprada)) || Number(item.cantidad_comprada) < 1) return res.status(400).json({ error: 'La cantidad comprada debe ser un entero mayor que cero' });
        if (!Number.isFinite(Number(item.precio_unitario_usdt)) || Number(item.precio_unitario_usdt) < 0) return res.status(400).json({ error: 'El precio unitario en USDT no es valido' });
    }
    let conn;
    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();
        const responsable = responsableInventario(req);
        let totalVes = 0;
        let totalUsdt = 0;
        for (const item of items) {
            totalUsdt += Number(item.precio_unitario_usdt) * Number(item.cantidad_comprada);
            totalVes += Number(item.precio_unitario_usdt) * Number(item.cantidad_comprada) * tasaVesUsdt;
        }
        const [compra] = await conn.query(
            `INSERT INTO compras (proveedor, proveedor_pais, responsable_admin_id, estado, fecha_compra, tasa_ars_usdt, tasa_ves_usdt, total_productos_ves, total_productos_usdt, total_puesto_usdt, observaciones)
             VALUES (?, ?, ?, 'pagada', ?, ?, ?, ?, ?, ?, ?)`,
            [String(body.proveedor).trim(), String(body.proveedor_pais || 'Venezuela').trim(), responsable.id || 0,
                body.fecha_compra || null, tasaArsUsdt, tasaVesUsdt, totalVes, totalUsdt, totalUsdt, body.observaciones || null]
        );
        for (const item of items) {
            await conn.query(
                `INSERT INTO compra_items (compra_id, codigo_proveedor, titulo, artista, genero, calidad, pais_origen, descripcion, imagen_url, cantidad_comprada, precio_unitario_ves, costo_unitario_usdt, costo_unitario_ars)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [compra.insertId, item.codigo_proveedor || null, String(item.titulo).trim(), String(item.artista).trim(), item.genero || null,
                    item.calidad || null, item.pais_origen || null, item.descripcion || null, item.imagen_url || null,
                    Number(item.cantidad_comprada), Number(item.precio_unitario_usdt) * tasaVesUsdt,
                    Number(item.precio_unitario_usdt), Number(item.precio_unitario_usdt) * tasaArsUsdt]
            );
        }
        await conn.commit();
        res.status(201).json({ success: true, id: compra.insertId });
    } catch (error) {
        if (conn) await conn.rollback().catch(() => {});
        next(error);
    } finally {
        if (conn) conn.release();
    }
});

app.get('/api/admin/compras/items/:id/preparar-inventario', requiereAdmin, async (req, res, next) => {
    try {
        const [filas] = await sql.query(
            `SELECT i.*, c.estado AS compra_estado
               FROM compra_items i JOIN compras c ON c.id = i.compra_id
              WHERE i.id = ?`, [Number(req.params.id)]
        );
        if (filas.length === 0) return res.status(404).json({ error: 'Item de compra no encontrado' });
        const item = filas[0];
        if (item.vinilo_id) return res.json({ ya_incorporado: true, vinilo_id: item.vinilo_id, item });
        const codigoSugerido = await siguienteCodigoInventario(sql);
        res.json({ ya_incorporado: false, codigo_sugerido: codigoSugerido, cantidad_pendiente: Number(item.cantidad_comprada) - Number(item.cantidad_recibida), item });
    } catch (error) {
        next(error);
    }
});

app.get('/api/vinilos', (req, res, next) => {
    db.query('SELECT * FROM inventario_vinilos ORDER BY id DESC', (err, results) => {
        // Mismo criterio que en divisas: el detalle del error queda en el log del
        // servidor, al navegador solo 'Error interno del servidor'.
        if (err) return next(err);
        res.json(results || []);
    });
});

app.post('/api/vinilos', requiereAdmin, (req, res, next) => {
    if (req.body?.compra_item_id !== undefined) return crearViniloDesdeCompra(req, res, next);
    const { codigo, titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, descripcion } = req.body;
    const responsable = responsableInventario(req);
    const query = `INSERT INTO inventario_vinilos (codigo, titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, descripcion, ultima_modificacion_en, ultima_modificacion_admin_id, ultima_modificacion_admin_email, ultima_modificacion_admin_nombre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`;
    db.query(query, [codigo, titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, descripcion, responsable.id, responsable.email, responsable.nombre], (err) => {
        if (err) return next(err);
        res.json({ success: true });
    });
});

// --- IMPORTACIÓN MASIVA (BULK UPDATE POR CÓDIGO) ---
// Debe declararse ANTES de /api/vinilos/:id para que Express no lo capture como un id.
app.put('/api/vinilos/bulk-update', requiereAdmin, (req, res, next) => {
    const entradas = Array.isArray(req.body) ? req.body : [req.body];
    if (entradas.length === 0) return res.status(400).json({ error: 'No se recibieron datos' });

    for (const item of entradas) {
        if (!item || !item.codigo) return res.status(400).json({ error: 'Cada fila debe incluir codigo' });
        if (Object.prototype.hasOwnProperty.call(item, 'version') && item.version !== null && item.version !== undefined && item.version !== '') {
            const version = Number(item.version);
            if (!Number.isInteger(version) || version < 0) return res.status(400).json({ error: 'version debe ser un entero mayor o igual a 0' });
        }
        if (item.stock_actual !== null && item.stock_actual !== undefined) {
            const stock = Number(item.stock_actual);
            if (!Number.isInteger(stock) || stock < 0) {
                return res.status(400).json({ error: 'stock_actual debe ser un entero mayor o igual a 0' });
            }
        }
    }

    db.getConnection((err, conn) => {
        if (err) return next(err);
        conn.beginTransaction((err) => {
            if (err) { conn.release(); return next(err); }

            const tareas = entradas.map(item => new Promise((resolve, reject) => {
                const sets = [];
                const vals = [];
                const responsable = responsableInventario(req);

                // Solo se actualizan los campos presentes: las celdas vacias del CSV no borran datos.
                if (item.imagen_url !== null && item.imagen_url !== undefined && item.imagen_url !== '') {
                    sets.push('imagen_url = ?');
                    vals.push(item.imagen_url);
                }
                if (item.stock_actual !== null && item.stock_actual !== undefined && item.stock_actual !== '') {
                    sets.push('stock_actual = ?');
                    vals.push(Math.trunc(Number(item.stock_actual)));
                }

                if (sets.length === 0) return resolve({ actualizados: 0, omitidos: 1 });

                sets.push('ultima_modificacion_en = NOW()', 'ultima_modificacion_admin_id = ?', 'ultima_modificacion_admin_email = ?', 'ultima_modificacion_admin_nombre = ?');
                vals.push(responsable.id, responsable.email, responsable.nombre);

                const tieneVersion = Object.prototype.hasOwnProperty.call(item, 'version')
                    && item.version !== null && item.version !== undefined && item.version !== '';
                if (tieneVersion) sets.push('version = version + 1');
                vals.push(item.codigo);
                if (tieneVersion) vals.push(Number(item.version));
                const condicion = tieneVersion ? 'WHERE codigo = ? AND version = ?' : 'WHERE codigo = ?';
                conn.query(`UPDATE inventario_vinilos SET ${sets.join(', ')} ${condicion}`, vals, (e, r) => {
                    if (e) return reject(e);
                    if (r.affectedRows > 0) return resolve({ actualizados: 1, omitidos: 0, conflictos: 0 });
                    if (!tieneVersion) return resolve({ actualizados: 0, omitidos: 1, conflictos: 0 });
                    conn.query('SELECT `id`, `codigo`, `version` FROM inventario_vinilos WHERE codigo = ?', [item.codigo], (consultaError, filas) => {
                        if (consultaError) return reject(consultaError);
                        if (filas.length === 0) return resolve({ actualizados: 0, omitidos: 1, conflictos: 0 });
                        resolve({ actualizados: 0, omitidos: 0, conflictos: [{ codigo: item.codigo, id: filas[0].id, version: Number(filas[0].version) }] });
                    });
                });
            }));

            Promise.all(tareas)
                .then(resultados => {
                    const actualizados = resultados.reduce((a, b) => a + b.actualizados, 0);
                    const omitidos = resultados.reduce((a, b) => a + b.omitidos, 0);
                    const conflictos = resultados.flatMap(resultado => resultado.conflictos || []);
                    conn.commit(() => {
                        conn.release();
                        res.json({ success: true, actualizados, omitidos, conflictos, recibidos: entradas.length });
                    });
                })
                // La liberacion va primero que el next: si la conexion se devuelve
                // al pool despues, otra peticion puede tomarla mientras esta
                // todavia esta escribiendo la respuesta de error.
                .catch(e => conn.rollback(() => { conn.release(); next(e); }));
        });
    });
});

app.put('/api/vinilos/:id', requiereAdmin, (req, res, next) => {
    const { id } = req.params;
    const { codigo, titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, descripcion, destacado } = req.body;
    const tieneVersion = Object.prototype.hasOwnProperty.call(req.body || {}, 'version')
        && req.body.version !== null && req.body.version !== undefined && req.body.version !== '';
    if (tieneVersion && (!Number.isInteger(Number(req.body.version)) || Number(req.body.version) < 0)) {
        return res.status(400).json({ error: 'version debe ser un entero mayor o igual a 0' });
    }
    const responsable = responsableInventario(req);
    const campos = 'codigo=?, titulo=?, artista=?, precio_venta=?, stock_actual=?, imagen_url=?, genero=?, calidad=?, descripcion=?, destacado=?, ultima_modificacion_en=NOW(), ultima_modificacion_admin_id=?, ultima_modificacion_admin_email=?, ultima_modificacion_admin_nombre=?';
    const query = tieneVersion
        ? `UPDATE inventario_vinilos SET ${campos}, version=version+1 WHERE id=? AND version=?`
        : `UPDATE inventario_vinilos SET ${campos} WHERE id=?`;
    const valores = [codigo, titulo, artista, precio_venta, stock_actual, imagen_url, genero, calidad, descripcion, Number(destacado) === 1 ? 1 : 0, responsable.id, responsable.email, responsable.nombre, id];
    if (tieneVersion) valores.push(Number(req.body.version));
    db.query(query, valores, (err, resultado) => {
        if (err) return next(err);
        if (!tieneVersion || resultado.affectedRows > 0) return res.json({ message: 'OK', version: tieneVersion ? Number(req.body.version) + 1 : undefined });
        db.query('SELECT * FROM inventario_vinilos WHERE id = ?', [id], (consultaError, filas) => {
            if (consultaError) return next(consultaError);
            if (filas.length === 0) return res.status(404).json({ error: 'Vinilo no encontrado' });
            res.status(409).json({ error: 'El vinilo cambió en el servidor. Recargá los datos antes de guardar.', actual: filas[0] });
        });
    });
});

app.delete('/api/vinilos/:id', requiereAdmin, (req, res, next) => {
    const { id } = req.params;
    db.query('DELETE FROM inventario_vinilos WHERE id = ?', [id], (err) => {
        if (err) return next(err);
        res.json({ message: 'Eliminado' });
    });
});

app.put('/api/vinilos/:id/destacado', requiereAdmin, (req, res, next) => {
    const { id } = req.params;
    const { destacado } = req.body;
    const tieneVersion = Object.prototype.hasOwnProperty.call(req.body || {}, 'version')
        && req.body.version !== null && req.body.version !== undefined && req.body.version !== '';
    if (tieneVersion && (!Number.isInteger(Number(req.body.version)) || Number(req.body.version) < 0)) {
        return res.status(400).json({ error: 'version debe ser un entero mayor o igual a 0' });
    }
    const responsable = responsableInventario(req);
    const query = tieneVersion
        ? 'UPDATE inventario_vinilos SET destacado = ?, version = version + 1, ultima_modificacion_en = NOW(), ultima_modificacion_admin_id = ?, ultima_modificacion_admin_email = ?, ultima_modificacion_admin_nombre = ? WHERE id = ? AND version = ?'
        : 'UPDATE inventario_vinilos SET destacado = ?, ultima_modificacion_en = NOW(), ultima_modificacion_admin_id = ?, ultima_modificacion_admin_email = ?, ultima_modificacion_admin_nombre = ? WHERE id = ?';
    const valores = [destacado, responsable.id, responsable.email, responsable.nombre, id];
    if (tieneVersion) valores.push(Number(req.body.version));
    db.query(query, valores, (err, resultado) => {
        if (err) return next(err);
        if (!tieneVersion || resultado.affectedRows > 0) return res.json({ success: true, version: tieneVersion ? Number(req.body.version) + 1 : undefined });
        db.query('SELECT * FROM inventario_vinilos WHERE id = ?', [id], (consultaError, filas) => {
            if (consultaError) return next(consultaError);
            if (filas.length === 0) return res.status(404).json({ error: 'Vinilo no encontrado' });
            res.status(409).json({ error: 'El vinilo cambió en el servidor. Recargá los datos antes de guardar.', actual: filas[0] });
        });
    });
});

app.post('/api/upload-multiple', requiereAdmin, upload.array('imagenes'), (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    const urls = req.files.map(file => `/uploads/${file.filename}`);
    res.json({ urls });
});

// ==========================================
// 3. GESTIÓN DE PEDIDOS (FIXED)
// ==========================================
app.get('/api/pedidos', requiereAdmin, (req, res, next) => {
    db.query('SELECT * FROM pedidos ORDER BY fecha DESC', (err, results) => {
        // El error de MySQL no se devuelve al cliente: lo responde el error
        // handler del final, que no filtra nombres de tablas ni de columnas.
        if (err) return next(err);
        res.json(results);
    });
});

// Historial del cliente logueado. Es el unico lugar donde un cliente ve pedidos.
app.get('/api/mis-pedidos', requiereCliente, (req, res, next) => {
    db.query('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY fecha DESC', [req.auth.usuario.id], (err, results) => {
        // Mismo criterio que el listado de arriba: el detalle del error queda en
        // el log del servidor, al navegador solo 'Error interno del servidor'.
        if (err) return next(err);
        res.json(results);
    });
});

// Error de negocio del pedido: mensaje en español para el cliente + rollback.
// Cualquier otro error (MySQL, red) lo maneja el error handler del final.
class ErrorPedido extends Error {
    constructor(mensaje) {
        super(mensaje);
        this.name = 'ErrorPedido';
    }
}

// Las Plumas se almacenan como centavos de USD: no se usan DECIMAL ni floats
// para decidir saldos. La migración crea estas tres tablas y las referencias
// únicas hacen que los efectos de pedidos sean idempotentes.
const PLUMAS_PORCENTAJE_PREMIO = 5;
const PLUMAS_MAX_PORCENTAJE_PAGO = 50;

async function cuentaRecompensas(conn, usuarioId) {
    await conn.query(
        'INSERT IGNORE INTO `recompensas_cuentas` (`usuario_id`, `saldo`) VALUES (?, 0)',
        [usuarioId]
    );
    const [filas] = await conn.query(
        'SELECT `usuario_id`, `saldo` FROM `recompensas_cuentas` WHERE `usuario_id` = ? FOR UPDATE',
        [usuarioId]
    );
    if (!filas[0]) throw new ErrorPedido('No se pudo abrir la cuenta de recompensas');
    return filas[0];
}

async function movimientoRecompensas(conn, { usuarioId, tipo, unidades, pedidoId = null, referencia, referenciaTipo = null, expiraEn = null }) {
    try {
        const [resultado] = await conn.query(
            `INSERT INTO \`recompensas_ledger\`
                (\`usuario_id\`, \`tipo\`, \`unidades\`, \`pedido_id\`, \`referencia_id\`, \`referencia_tipo\`, \`expira_en\`)
             VALUES (?, ?, ?, ?, ?, ?, IF(? = 1, DATE_ADD(NOW(), INTERVAL 12 MONTH), NULL))`,
            [usuarioId, tipo, unidades, pedidoId, referencia, referenciaTipo, expiraEn ? 1 : 0]
        );
        return { id: Number(resultado.insertId), creado: true };
    } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
    const [existentes] = await conn.query(
        'SELECT `id` FROM `recompensas_ledger` WHERE `usuario_id` = ? AND `referencia_id` = ? FOR UPDATE',
        [usuarioId, referencia]
    );
    if (!existentes[0]) throw new ErrorPedido('No se pudo confirmar el movimiento de recompensas');
    return { id: Number(existentes[0].id), creado: false };
}

function unidadesDesdeDolares(valor) {
    return Math.max(0, Math.round(Number(valor) * 100));
}

function unidadesSolicitadas(valor) {
    if (valor === undefined || valor === null || valor === '') return 0;
    const unidades = Number(valor);
    if (!Number.isInteger(unidades) || unidades < 0) throw new ErrorPedido('Las recompensas_unidades deben ser un entero mayor o igual a 0');
    return unidades;
}

// ==========================================
// 2.5 RECOMPENSAS (PLUMAS)
// ==========================================
app.get('/api/recompensas/saldo', requiereCliente, async (req, res, next) => {
    try {
        const [filas] = await sql.query(
            'SELECT `saldo` FROM `recompensas_cuentas` WHERE `usuario_id` = ?',
            [req.auth.usuario.id]
        );
        res.json({ saldo_unidades: Number(filas[0]?.saldo || 0), valor_usd: Number(filas[0]?.saldo || 0) / 100 });
    } catch (e) { next(e); }
});

// Consulta liviana para avisar al panel de pedidos nuevos sin descargar todo
// el historial cada vez que se revisa el estado.
app.get('/api/admin/pedidos/novedades', requiereAdmin, (req, res, next) => {
    const desdeId = Number.parseInt(String(req.query.desde_id || '0'), 10);
    const idInicial = Number.isFinite(desdeId) && desdeId >= 0 ? desdeId : 0;
    db.query(
        `SELECT id_pedido, numero_orden, fecha, nombre_cliente, estado
           FROM pedidos
          WHERE id_pedido > ? AND estado = 'pendiente'
          ORDER BY id_pedido ASC
          LIMIT 20`,
        [idInicial],
        (err, results) => {
            if (err) return next(err);
            res.json(results);
        }
    );
});

app.get('/api/recompensas/movimientos', requiereCliente, async (req, res, next) => {
    try {
        const limite = Math.min(100, Math.max(1, Number(req.query.limite) || 50));
        const [filas] = await sql.query(
            `SELECT \`id\`, \`tipo\`, \`unidades\`, \`pedido_id\`, \`referencia_id\`, \`referencia_tipo\`, \`creado_en\`
               FROM \`recompensas_ledger\`
              WHERE \`usuario_id\` = ? ORDER BY \`id\` DESC LIMIT ?`,
            [req.auth.usuario.id, limite]
        );
        res.json(filas);
    } catch (e) { next(e); }
});

app.post('/api/recompensas/cotizar', requiereCliente, async (req, res, next) => {
    try {
        const body = req.body || {};
        if (!Array.isArray(body.items) || body.items.length === 0) return res.status(400).json({ error: 'El pedido no tiene items' });
        const pedidos = body.items.map(item => {
            const id = Number(item?.id); const cantidad = Number(item?.cantidad);
            if (!Number.isInteger(id) || id < 1 || !Number.isInteger(cantidad) || cantidad < 1) throw new ErrorPedido('Items inválidos');
            return { id, cantidad };
        });
        const conn = await sql.getConnection();
        try {
            await conn.beginTransaction();
            const ids = [...new Set(pedidos.map(p => p.id))].sort((a, b) => a - b);
            const [vinilos] = await conn.query(
                `SELECT \`id\`, \`precio_venta\` FROM \`inventario_vinilos\` WHERE \`id\` IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids
            );
            const precios = new Map(vinilos.map(v => [Number(v.id), Number(v.precio_venta)]));
            if (pedidos.some(p => !precios.has(p.id))) throw new ErrorPedido('Uno de los vinilos ya no está disponible');
            const subtotal = Math.round(pedidos.reduce((s, p) => s + precios.get(p.id) * p.cantidad, 0) * 100) / 100;
            let total = subtotal;
            if (body.cupon_id !== undefined && body.cupon_id !== null && body.cupon_id !== '') {
                const cuponId = Number(body.cupon_id);
                if (!Number.isInteger(cuponId) || cuponId < 1) throw new ErrorPedido('El cupón no es válido');
                const [cupones] = await conn.query(`SELECT \`tipo\`, \`valor\`, \`activo\`, DATE_FORMAT(\`fecha_expiracion\`, '%Y-%m-%d') AS \`fecha_expiracion\`, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS \`hoy\`, \`uso_maximo\`, \`usos_actuales\` FROM \`cupones\` WHERE \`id\` = ? FOR UPDATE`, [cuponId]);
                const cupon = cupones[0];
                if (!cupon || !cupon.activo || (cupon.fecha_expiracion && cupon.fecha_expiracion < cupon.hoy) || (cupon.uso_maximo !== null && Number(cupon.usos_actuales) >= Number(cupon.uso_maximo))) throw new ErrorPedido('El cupón no es válido');
                const descuentoCupon = cupon.tipo === 'porcentaje' ? subtotal * Number(cupon.valor) / 100 : Number(cupon.valor);
                total = Math.max(0, Math.round((subtotal - descuentoCupon) * 100) / 100);
            }
            const cuenta = await cuentaRecompensas(conn, req.auth.usuario.id);
            const unidades = unidadesSolicitadas(body.recompensas_unidades);
            const maximas = Math.min(Number(cuenta.saldo), Math.floor(unidadesDesdeDolares(total) * PLUMAS_MAX_PORCENTAJE_PAGO / 100));
            await conn.rollback();
            res.json({ saldo_unidades: Number(cuenta.saldo), subtotal_usd: subtotal, total_neto_usd: total, max_unidades: maximas, recompensas_unidades: Math.min(unidades, maximas), descuento_recompensas_usd: Math.min(unidades, maximas) / 100 });
        } finally { conn.release(); }
    } catch (e) { if (e instanceof ErrorPedido) return res.status(400).json({ error: e.message }); next(e); }
});

app.get('/api/admin/recompensas/ledger', requiereAdmin, async (req, res, next) => {
    try {
        const usuarioId = req.query.usuario_id === undefined ? null : Number(req.query.usuario_id);
        if (usuarioId !== null && (!Number.isInteger(usuarioId) || usuarioId < 1)) return res.status(400).json({ error: 'usuario_id inválido' });
        const [filas] = await sql.query(
            `SELECT m.\`id\`, m.\`usuario_id\`, u.\`email\`, u.\`nombre\`, m.\`tipo\`, m.\`unidades\`, m.\`pedido_id\`, m.\`referencia_id\`, m.\`referencia_tipo\`, m.\`creado_en\`
               FROM \`recompensas_ledger\` m JOIN \`usuarios\` u ON u.\`id\` = m.\`usuario_id\`
              WHERE (? IS NULL OR m.\`usuario_id\` = ?) ORDER BY m.\`id\` DESC LIMIT 500`, [usuarioId, usuarioId]
        );
        res.json(filas);
    } catch (e) { next(e); }
});

app.post('/api/admin/recompensas/ajustes', requiereAdminMaximo, async (req, res, next) => {
    const body = req.body || {};
    const usuarioId = Number(body.usuario_id);
    const unidades = Number(body.unidades);
    const motivo = typeof body.motivo === 'string'
        ? body.motivo.trim()
        : (typeof body.descripcion === 'string' ? body.descripcion.trim() : '');
    const claveRecibida = typeof body.idempotency_key === 'string'
        ? body.idempotency_key.trim()
        : (typeof body.referencia === 'string' ? body.referencia.trim() : '');
    if (typeof body.idempotency_key === 'string' && typeof body.referencia === 'string'
        && body.idempotency_key.trim() !== body.referencia.trim()) {
        return res.status(400).json({ error: 'idempotency_key y referencia deben coincidir' });
    }
    const tieneClaveValida = claveRecibida.length >= 1
        && claveRecibida.length <= 128
        && !/[\u0000-\u001f\u007f]/.test(claveRecibida);
    if (!Number.isInteger(usuarioId) || usuarioId < 1
        || !Number.isInteger(unidades) || unidades === 0 || Math.abs(unidades) > 100000
        || motivo.length < 10 || motivo.length > 500 || !tieneClaveValida) {
        return res.status(400).json({ error: 'usuario_id válido, unidades enteras entre -100000 y 100000 (no nulas), motivo de 10 a 500 caracteres e idempotency_key son obligatorios' });
    }
    const referencia = `ajuste:${claveRecibida}`;
    const pedidoId = body.pedido_id === undefined || body.pedido_id === null || body.pedido_id === ''
        ? null
        : Number(body.pedido_id);
    if (pedidoId !== null && (!Number.isInteger(pedidoId) || pedidoId < 1)) return res.status(400).json({ error: 'pedido_id inválido' });
    let conn = null;
    try {
        conn = await sql.getConnection(); await conn.beginTransaction();
        const [usuarios] = await conn.query('SELECT `id` FROM `usuarios` WHERE `id` = ? FOR SHARE', [usuarioId]);
        if (!usuarios[0]) throw new ErrorPedido('El usuario no existe');
        if (pedidoId !== null) {
            const [pedidos] = await conn.query('SELECT `id_pedido` FROM `pedidos` WHERE `id_pedido` = ? AND `usuario_id` = ? FOR SHARE', [pedidoId, usuarioId]);
            if (!pedidos[0]) throw new ErrorPedido('El pedido no existe o no pertenece al usuario');
        }
        const cuenta = await cuentaRecompensas(conn, usuarioId);
        const movimiento = await movimientoRecompensas(conn, { usuarioId, tipo: 'ajuste', unidades, pedidoId, referencia, referenciaTipo: 'ajuste' });
        if (!movimiento.creado) {
            const [existente] = await conn.query(
                'SELECT `id`, `usuario_id`, `unidades`, `pedido_id`, `referencia_id`, `referencia_tipo`, `creado_en` FROM `recompensas_ledger` WHERE `id` = ?',
                [movimiento.id]
            );
            const fila = existente[0];
            if (!fila || Number(fila.usuario_id) !== usuarioId || Number(fila.unidades) !== unidades || (fila.pedido_id === null ? null : Number(fila.pedido_id)) !== pedidoId) {
                throw new ErrorPedido('La idempotency_key ya fue usada con otro ajuste');
            }
            await conn.commit();
            return res.json({ success: true, idempotente: true, movimiento: { ...fila, motivo, idempotency_key: claveRecibida }, saldo_unidades: Number(cuenta.saldo) });
        }
        const saldo = Number(cuenta.saldo) + unidades;
        if (saldo < 0) throw new ErrorPedido('El ajuste no puede dejar saldo negativo');
        await conn.query('UPDATE `recompensas_cuentas` SET `saldo` = ? WHERE `usuario_id` = ?', [saldo, usuarioId]);
        await conn.commit();
        res.json({ success: true, idempotente: false, movimiento: { id: movimiento.id, usuario_id: usuarioId, pedido_id: pedidoId, tipo: 'ajuste', unidades, motivo, idempotency_key: claveRecibida }, saldo_unidades: saldo });
    } catch (e) { if (conn) await conn.rollback().catch(() => {}); if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'La idempotency_key ya fue aplicada' }); if (e instanceof ErrorPedido) return res.status(400).json({ error: e.message }); next(e); }
    finally { if (conn) conn.release(); }
});

// El `numero_orden` NO sale de un azar: sale del `id_pedido` autoincremental
// (ver el INSERT de mas abajo). Pocos reintentos alcanzan porque lo unico que
//Todavia es aleatorio es el token temporal que ocupa el numero durante el
// INSERT; el numero en si no puede chocar con nada. Y el 1062 sigue siendo
// una red de seguridad: la migracion declara el UNIQUE de `numero_orden`, pero
// DENTRO del `CREATE TABLE IF NOT EXISTS`, asi que en una base ya existente
// (produccion) el indice no existe y, cuando exista, el INSERT tiene que
// tolerar el 1062 en vez de romper el checkout.
const MAX_REINTENTOS_NUMERO_ORDEN = 5;

// --- RATE LIMIT DE POST /api/pedidos ---
// POR QUE EL CHECKOUT TAMBIEN NECESITA UN TECHO
//   Es una ruta publica (se compra sin cuenta) y antes no tenia ninguno. Y el
//   riesgo no era solo Denial of Service: cada respuesta de cupon decia en
//   detalle por que se rechazaba, asi que recorrer los ids correlativos de
//   `cupones` permitia sacar el catalogo entero (existencia, estado, vigencia
//   y usos de cada cupon) sin costo. Con el mensaje unico de mas abajo y este
//   techo, el recorrido sale caro.
//   30 y no 5: el techo tiene que frenar el sondeo, no castigar a la gente. En
//   Argentina los operadores moviles usan CGNAT, asi que una IPv4 la comparten
//   decenas o cientos de personas, y un local con un solo enlace parece una IP
//   sola. Con 30 pedidos en 10 minutos un abusivo de verdad se queda corto y
//   una familia entera sigue pudiendo comprar. El 429 lo recibe el que agota la
//   cuota, no el ultimo de la fila: cada pedido cuenta uno, porque el que
//   amenaza el inventario y el catalogo de cupones es el que los manda de verdad.
const MAX_PEDIDOS_POR_IP = 30;
const VENTANA_PEDIDO_MS = 10 * 60 * 1000;
const TEXTO_429_PEDIDO = 'Demasiados pedidos desde esta conexión. Probá de nuevo en unos minutos.';
const rateLimitPedido = crearRateLimitPorIP({
    max: MAX_PEDIDOS_POR_IP,
    ventanaMs: VENTANA_PEDIDO_MS,
    texto429: TEXTO_429_PEDIDO
});

// La compra sigue siendo publica (se puede comprar sin cuenta). Si hay cookie
// de cliente se guarda usuario_id, asi despues aparece en "mis pedidos".
//
// POR QUE EL TOTAL SE CALCULA ACA Y NO VIENE DEL CLIENTE
//   Antes el cliente mandaba `total_pago` y el servidor lo guardaba tal cual:
//   cualquiera podia POSTear { total_pago: 0.01, items: [...] } y comprar el
//   catalogo entero por un centimo. El precio de cada vinilo y la regla del
//   cupon son datos del servidor: se leen de la base dentro de la misma
//   transaccion que descuenta el stock, se calcula el subtotal, se aplica el
//   descuento y SOLO eso se guarda en `total_pago` (siempre en USD, que es como
//   esta guardado el catalogo; `divisa_preferida` se sigue guardando aparte y
//   la conversion la muestra el frontend).
app.post('/api/pedidos', rateLimitPedido.middleware, sesionClienteOpcional, async (req, res, next) => {
    const body = req.body || {};
    const perfil = req.auth?.usuario || null;
    const usuario_id = perfil?.id || null;

    // Con sesion, ambos datos salen del perfil que `sesionClienteOpcional` lee
    // desde `usuarios` (`req.auth.usuario` tiene id, email, nombre, telefono y
    // avatar_url). No se usa el body para evitar que un cliente logueado suplante
    // otro nombre o desplace el pedido a un WhatsApp ajeno. Sin sesion, el pedido
    // sigue siendo anonimo y usa los datos enviados por el comprador.
    const textoPlano = (v) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
    const nombreDelBody = textoPlano(body.nombre_cliente);
    const whatsappDelBody = textoPlano(body.whatsapp_cliente);
    const nombre_cliente = perfil
        ? textoPlano(perfil.nombre) || null
        : nombreDelBody || null;
    const whatsapp_cliente = perfil
        ? textoPlano(perfil.telefono) || null
        : whatsappDelBody || null;

    // M-3, TRUNCADO SERVER-SIDE: `nombre_cliente` es VARCHAR(120) y
    // `whatsapp_cliente` VARCHAR(32). Sin recortar aca, un valor mas largo
    // (un campo sin maxLength, un pegado desde el celu, un POST a mano) revienta
    // con MySQL 1406 "Data too long" y el cliente se come un 500 generico sin
    // saber que paso. El frontend tambien recorta, pero eso es el cliente y el
    // cliente no es una garantia: el server es la red de seguridad.
    const nombreGuardado = nombre_cliente ? String(nombre_cliente).slice(0, 120) : null;
    const whatsappGuardado = whatsapp_cliente ? String(whatsapp_cliente).slice(0, 32) : null;

    let conn = null;

    try {
        // --- 1) Validacion de items (antes de tocar la base) ---
        if (!Array.isArray(body.items) || body.items.length === 0) {
            throw new ErrorPedido('El pedido no tiene items');
        }

        const pedidos = body.items.map((item) => {
            const id = Number(item?.id);
            const cantidad = Number(item?.cantidad);
            if (!Number.isInteger(id) || id < 1) throw new ErrorPedido('Cada item necesita un id de vinilo valido');
            if (!Number.isInteger(cantidad) || cantidad < 1) {
                throw new ErrorPedido('Cada cantidad tiene que ser un entero mayor o igual a 1');
            }
            return { id, cantidad };
        });

        const recompensasUnidades = unidadesSolicitadas(body.recompensas_unidades);
        if (recompensasUnidades > 0 && !perfil) throw new ErrorPedido('Necesitás iniciar sesión para usar Plumas');

        conn = await sql.getConnection();
        await conn.beginTransaction();

        // La dirección es una referencia del usuario, no texto confiable del
        // navegador. Se bloquea y se copia dentro de esta misma transacción para
        // que el pedido conserve una foto aunque después la dirección cambie.
        let direccionSnapshot = {
            id: null,
            apodo: null,
            direccion: null,
            ciudad: null,
            provincia: null,
            codigo_postal: null,
        };
        if (perfil) {
            const direccionId = body.direccion_id === '' || body.direccion_id === null || body.direccion_id === undefined
                ? null
                : Number(body.direccion_id);
            if (direccionId !== null && (!Number.isInteger(direccionId) || direccionId < 1)) {
                throw new ErrorPedido('La dirección seleccionada no es válida');
            }
            if (direccionId !== null) {
                const [direcciones] = await conn.query(
                    `SELECT
                        \`id\`, \`apodo\`, \`direccion\`, \`ciudad\`, \`provincia\`, \`codigo_postal\`
                       FROM \`direcciones\`
                      WHERE \`id\` = ? AND \`usuario_id\` = ?
                      FOR UPDATE`,
                    [direccionId, perfil.id]
                );
                if (direcciones.length === 0) {
                    throw new ErrorPedido('La dirección seleccionada no existe o no pertenece a tu cuenta');
                }
                direccionSnapshot = direcciones[0];
            }
        }

        // --- 2) Subtotal desde la base (el `total_pago` del cliente se ignora) ---
        // FOR UPDATE: los precios que se leen son los que se usan para el total, y
        // el stock queda bloqueado hasta el commit, asi que la fila que se descuenta
        // es exactamente la que se sumo.
        // M-9, ORDEN DE BLOQUEO FIJO: los ids van ordenados ANTES del SELECT
        // ... FOR UPDATE, y no en el orden que mande el carrito. Dos pedidos
        // concurrentes con los mismos vinilos en orden inverso (A compra 3 y 7,
        // B compra 7 y 3) se bloqueaban mutuamente y MySQL mataba una de las
        // dos con ER_LOCK_DEADLOCK, tirando el checkout con un 500 sin reintento.
        // InnoDB aborta el que detecta el ciclo; no hay nada que reintentar del
        // lado del cliente, se pierde la venta. Con el orden siempre ascendente
        // las dos transacciones piden los locks en la misma secuencia, asi que
        // no hay ciclo posible. Los UPDATEs de stock de mas abajo no necesitan
        // el mismo cuidado: re-toman locks que esta transaccion ya tiene.
        const ids = [...new Set(pedidos.map(p => p.id))].sort((a, b) => a - b);
        const [vinilos] = await conn.query(
            `SELECT \`id\`, \`titulo\`, \`precio_venta\`, \`stock_actual\`
               FROM \`inventario_vinilos\`
              WHERE \`id\` IN (${ids.map(() => '?').join(', ')})
              FOR UPDATE`,
            ids
        );

        const porId = new Map(vinilos.map(v => [Number(v.id), v]));
        const precios = new Map(vinilos.map(v => [Number(v.id), Number(v.precio_venta)]));
        for (const p of pedidos) {
            if (!precios.has(p.id)) throw new ErrorPedido(`El vinilo ${p.id} ya no esta disponible`);
        }

        let subtotal = 0;
        for (const p of pedidos) subtotal += precios.get(p.id) * p.cantidad;
        subtotal = Math.round(subtotal * 100) / 100;

        // --- 3) Cupon: se valida DENTRO de la transaccion ---
        // El `POST /api/cupones/validar` del carrito es solo una ayuda visual: el
        // descuento que se aplica es el de esta validacion, contra la base.
        // FOR UPDATE + el UPDATE de usos en la misma transaccion hacen que dos
        // pedidos concurrentes no puedan gastarse el mismo uso del cupon.
        let total = subtotal;
        // `descuento` es lo que se guarda en `pedidos.descuento_aplicado`: sin
        // esta variable el unico rastro del beneficio era el total final, y el
        // backoffice no podia mostrar cuanto se descontó ni auditarlo.
        let descuento = 0;
        let cuponAplicado = null;
        let recompensasUsadas = 0;
        let descuentoRecompensas = 0;
        const cuponId = (body.cupon_id === '' || body.cupon_id === null || body.cupon_id === undefined)
            ? null
            : Number(body.cupon_id);

        if (cuponId !== null) {
            if (!Number.isInteger(cuponId) || cuponId < 1) throw new ErrorPedido('El cupón enviado no es válido');

            // DATE_FORMAT en las dos fechas: la comparacion es entre strings
            // YYYY-MM-DD, sin que el timezone del servidor mueva el dia.
            const [filas] = await conn.query(
                `SELECT \`id\`, \`codigo\`, \`tipo\`, \`valor\`,
                        DATE_FORMAT(\`fecha_expiracion\`, '%Y-%m-%d') AS \`fecha_expiracion\`,
                        \`activo\`, \`uso_maximo\`, \`usos_actuales\`,
                        DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS \`hoy\`
                   FROM \`cupones\`
                  WHERE \`id\` = ?
                  FOR UPDATE`,
                [cuponId]
            );

            const cupon = filas[0];
            // I-2, UN SOLO MENSAJE PARA LOS CUATRO MOTIVOS
            //   Antes cada motivo tenía su texto ("no existe" / "está
            //   desactivado" / "está vencido" / "ya agotó sus usos") y eso
            //   convertia al checkout en un oraculo: los ids de `cupones` son
            //   enteros correlativos, asi que con cuatro respuestas distintas
            //   un atacante que recorre 1, 2, 3... deduce que cupones existen,
            //   si estan activos, cuando vencen y cuantos usos les quedan. Esta
            //   ruta no tiene sesion ni forma de frenarlo, y contradice al
            //   endpoint /api/cupones/validar, que si esta endurecido a proposito
            //   justamente para no dar esa informacion. Un solo texto para los
            //   cuatro casos: el mismo criterio que en /validar.
            //   El texto sigue matcheando /cup[oó]n/i (src/components/Cart.tsx),
            //   asi que el carrito le puede ofrecer reintentar sin cupon. La
            //   razon real no se pierde: va al log del servidor, con el id y el
            //   codigo del cupon y NADA del cliente (por si hay que auditar una
            //   campana que empezo a fallar).
            const rechazarCupon = (motivo) => {
                console.warn(
                    `POST /api/pedidos: cupón ${cupon ? cupon.codigo : '(sin fila)'} (id ${cuponId}) rechazado: ${motivo}`
                );
                throw new ErrorPedido('El cupón no es válido');
            };
            if (!cupon) rechazarCupon('no existe');
            if (!cupon.activo) rechazarCupon('desactivado');
            if (cupon.fecha_expiracion && cupon.fecha_expiracion < cupon.hoy) rechazarCupon('vencido');
            if (cupon.uso_maximo !== null && Number(cupon.usos_actuales) >= Number(cupon.uso_maximo)) {
                rechazarCupon('usos agotados');
            }

            const valor = Number(cupon.valor);
            const descuentoTeorico = cupon.tipo === 'porcentaje' ? (subtotal * valor) / 100 : valor;
            // Math.max(0, ...): un cupon fijo mayor que el subtotal deja el total en
            // 0, nunca en negativo.
            total = Math.max(0, Math.round((subtotal - descuentoTeorico) * 100) / 100);
            // Se guarda el descuento REALMENTE aplicado (subtotal - total) y no el
            // teorico: asi subtotal - descuento = total da exacto en el panel, en
            // vez de mostrar un beneficio que no cuadra con lo que se cobró.
            descuento = Math.round((subtotal - total) * 100) / 100;
            cuponAplicado = cupon.codigo;

            // EL CONTADOR SOLO SE CUENTA CON TOPE: `usos_actuales` existe para
            // compararlo contra `uso_maximo`; si el cupón es ilimitado (uso_maximo
            // NULL) no hay comparación que hacer, y acumular usos sería ruido que
            // la cancelación después tendría que devolver. Condicionar el
            // incremento mantiene el invariante "contador = usos de cupones con
            // tope", y un cupón sin límite usado N veces sigue descontando
            // siempre porque la validación de arriba ya no chequea el contador
            // cuando no hay tope.
            if (cupon.uso_maximo !== null && cupon.uso_maximo !== undefined) {
                await conn.query('UPDATE `cupones` SET `usos_actuales` = `usos_actuales` + 1 WHERE `id` = ?', [cuponId]);
            }
        }

        // El cupón se aplica primero; el límite de Plumas se calcula sobre el
        // subtotal neto y el saldo se bloquea antes de consumirlo.
        if (recompensasUnidades > 0) {
            const cuenta = await cuentaRecompensas(conn, usuario_id);
            const maximas = Math.min(Number(cuenta.saldo), Math.floor(unidadesDesdeDolares(total) * PLUMAS_MAX_PORCENTAJE_PAGO / 100));
            if (recompensasUnidades > maximas) throw new ErrorPedido(`Podés usar como máximo ${maximas} Plumas en este pedido`);
            recompensasUsadas = recompensasUnidades;
            descuentoRecompensas = recompensasUsadas / 100;
            total = Math.round((total - descuentoRecompensas) * 100) / 100;
        }

        // --- 4) Stock (la resta sigue siendo condicional: no se puede quedar en negativo) ---
        for (const p of pedidos) {
            const [resultado] = await conn.query(
                'UPDATE `inventario_vinilos` SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?',
                [p.cantidad, p.id, p.cantidad]
            );
            if (resultado.affectedRows === 0) throw new ErrorPedido(`No hay stock suficiente del vinilo ${p.id}`);
        }

        // --- 5) Se guarda el pedido con el total CALCULADO ---
        // En `items` se guarda la foto de lo comprado (id, cantidad, titulo y el
        // precio aplicado), leida de las mismas filas bloqueadas: si despues se
        // renombra o cambia el precio del vinilo, el pedido ya guardado no cambia.
        // PUT /api/pedidos/:id/cancelar usa el id y la cantidad para devolver stock.
        const itemsGuardados = pedidos.map(p => ({
            id: p.id,
            cantidad: p.cantidad,
            titulo: porId.get(p.id).titulo,
            precio_unitario: precios.get(p.id),
        }));

        // I-3, EL NUMERO DE ORDEN SALE DEL `id_pedido`, NO DEL AZAR
        //   Antes era `GR-` + 4 dígitos al azar. El UNIQUE de `numero_orden` está
        //   DENTRO del `CREATE TABLE IF NOT EXISTS` de la migración, así que solo
        //   se materializa en una base nueva: en producción, donde `pedidos` ya
        //   existe, el índice no está. Sin índice, un choque no rompe el INSERT
        //   (no hay nada que rompa), el reintento nunca se dispara y quedan DOS
        //   pedidos con el mismo #GR-4821, sin forma de saber cuál confirmar. Con
        //   4 dígitos y 50 pedidos la chance de choque es ~13%, con 100 es ~42%:
        //   no es un riesgo teórico, es el caso normal de una tienda que vende.
        //   El `id_pedido` es autoincremental, así que nunca choca con nada.
        //   Cómo se hace sin dos transacciones: la columna es NOT NULL, así que el
        //   INSERT necesita un valor, y el id todavía no existe hasta que se
        //   inserta. Va un token temporal (que no puede chocar con un `GR-####` por
        //   el prefijo) y en la MISMA transacción, apenas se sabe el insertId, un
        //   UPDATE deja el número definitivo. Es atómico: o committea con el
        //   número puesto, o no queda nada.
        //   El reintento queda para cuando el UNIQUE sí exista (base nueva, o
        //   cuando se agregue a mano en producción) y solo para el INSERT: si el
        //   UPDATE fallara, la fila quedaría con el token TMP- y el rollback de
        //   abajo se la lleva, así que ahí no hay nada que reintentar. Solo se
        //   re-ejecuta el INSERT (con otro token): el stock y el uso del cupón ya
        //   descontados en ESTA transacción siguen valiendo para el mismo pedido,
        //   no hace falta rollback ni repetir los pasos anteriores.
        const tokenTemporal = () => `TMP-${randomBytes(6).toString('hex')}`;
        let numero_orden = '';
        let insertOk = false;
        let insercion = null;
        for (let intento = 0; intento < MAX_REINTENTOS_NUMERO_ORDEN && !insertOk; intento++) {
            try {
                [insercion] = await conn.query(
                    `INSERT INTO \`pedidos\`
                        (\`numero_orden\`, \`nombre_cliente\`, \`whatsapp_cliente\`, \`total_pago\`,
                         \`divisa_preferida\`, \`estado\`, \`fecha\`, \`items\`, \`usuario_id\`,
                         \`cupon_id\`, \`cupon_codigo\`, \`descuento_aplicado\`,
                         \`direccion_id\`, \`direccion_apodo\`, \`direccion\`, \`direccion_ciudad\`,
                         \`direccion_provincia\`, \`direccion_codigo_postal\`, \`recompensas_ganadas\`,
                         \`recompensas_usadas\`, \`descuento_recompensas_usd\`, \`recompensas_reversionadas\`)
                     VALUES (?, ?, ?, ?, ?, 'pendiente', NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        tokenTemporal(),
                        // Los valores ya vienen recortados (M-3): las columnas son
                        // VARCHAR(120) y VARCHAR(32) y un valor más largo revienta
                        // el INSERT con 1406.
                        nombreGuardado,
                        whatsappGuardado,
                        total,
                        body.divisa_preferida || null,
                        JSON.stringify(itemsGuardados),
                        usuario_id,
                        // El cupon queda pegado al pedido (no solo al total): es lo que
                        // permite mostrarlo en el backoffice y lo que hace que la
                        // cancelacion sepa que uso hay que devolver.
                        cuponId,
                        cuponAplicado,
                        descuento,
                        direccionSnapshot.id,
                        direccionSnapshot.apodo,
                        direccionSnapshot.direccion,
                        direccionSnapshot.ciudad,
                        direccionSnapshot.provincia,
                        direccionSnapshot.codigo_postal,
                        0,
                        recompensasUsadas,
                        descuentoRecompensas,
                        0
                    ]
                );
            } catch (e) {
                // Un 1062 acá solo puede venir del UNIQUE de `numero_orden` (las
                // demas columnas no tienen constraint): cualquier otro error se
                // propaga tal cual.
                if (e.code !== 'ER_DUP_ENTRY') throw e;
                continue;
            }

            // 4 dígitos con relleno para que los primeros se vean iguales a los
            // de siempre (GR-0007). Pasado el 9999 el número crece solo: entra de
            // sobra en el VARCHAR(20) y nadie lo parsea, el panel lo muestra como
            // texto.
            numero_orden = `GR-${String(insercion.insertId).padStart(4, '0')}`;
            await conn.query('UPDATE `pedidos` SET `numero_orden` = ? WHERE `id_pedido` = ?', [numero_orden, insercion.insertId]);
            if (recompensasUsadas > 0) {
                const consumoLedger = await movimientoRecompensas(conn, { usuarioId: usuario_id, tipo: 'canje', unidades: -recompensasUsadas, pedidoId: insercion.insertId, referencia: `pedido:${insercion.insertId}:canje`, referenciaTipo: 'pedido' });
                const consumoLedgerId = consumoLedger.id;
                const [lotes] = await conn.query(
                    `SELECT l.\`id\`, l.\`unidades\`, COALESCE(SUM(c.\`unidades\` - c.\`unidades_reversionadas\`), 0) AS \`usadas\`
                       FROM \`recompensas_ledger\` l LEFT JOIN \`recompensas_consumos\` c ON c.\`origen_ledger_id\` = l.\`id\`
                      WHERE l.\`usuario_id\` = ? AND l.\`unidades\` > 0 AND l.\`tipo\` IN ('ganancia', 'ajuste') AND (l.\`expira_en\` IS NULL OR l.\`expira_en\` > NOW())
                   GROUP BY l.\`id\`, l.\`unidades\` HAVING l.\`unidades\` > \`usadas\` ORDER BY l.\`id\` ASC FOR UPDATE`, [usuario_id]
                );
                let restantes = recompensasUsadas;
                for (const lote of lotes) {
                    if (restantes === 0) break;
                    const disponibles = Number(lote.unidades) - Number(lote.usadas);
                    const usadas = Math.min(restantes, disponibles);
                    await conn.query('INSERT INTO `recompensas_consumos` (`usuario_id`, `consumo_ledger_id`, `origen_ledger_id`, `unidades`) VALUES (?, ?, ?, ?)', [usuario_id, consumoLedgerId, lote.id, usadas]);
                    restantes -= usadas;
                }
                if (restantes !== 0) throw new ErrorPedido('El saldo de Plumas cambió. Intentá de nuevo.');
                if (consumoLedger.creado) {
                    await conn.query('UPDATE `recompensas_cuentas` SET `saldo` = `saldo` - ? WHERE `usuario_id` = ?', [recompensasUsadas, usuario_id]);
                }
            }
            insertOk = true;
        }

        // Si los reintentos no alcanzaron, la transaccion entera se cae sin
        // pedido inventado; el cliente ve un mensaje claro y puede reintentar.
        if (!insertOk) throw new ErrorPedido('No se pudo guardar el pedido. Intentá de nuevo.');

        await conn.commit();
        void notificarNuevoPedido({ idPedido: insercion.insertId, numeroOrden: numero_orden, nombreCliente: nombreGuardado })
            .catch(error => console.error('No se pudo enviar la notificación de pedido:', error.message));
        res.json({ success: true, numero_orden, total_pago: total, cupon: cuponAplicado, descuento, recompensas_usadas: recompensasUsadas, descuento_recompensas_usd: descuentoRecompensas });
    } catch (e) {
        // Todo lo que se hizo en la transaccion (stock, usos del cupon, fila del
        // pedido) se deshace: un error de negocio no deja el inventario tocado.
        if (conn) await conn.rollback().catch(() => {});
        if (e instanceof ErrorPedido) return res.status(400).json({ error: e.message });
        next(e);
    } finally {
        if (conn) conn.release();
    }
});

// --- CANCELAR PEDIDO ---
// POR QUE EL SNAPSHOT SE LEE DE LA BASE Y NO DEL BODY
//   La version anterior repedia stock con los `items` que mandaba el navegador:
//   era manipulable (POSTear { items: [{ id: 1, cantidad: 9999 }] } inflaba el
//   inventario) y no era idempotente (llamar dos veces devolvia el doble). El
//   `FOR UPDATE` sobre la fila del pedido deja el estado previo y los ids/cantidades
//   bajo el mismo lock, asi que se repone exactamente lo que se desconto en el
//   POST /api/pedidos. Por eso `req.body` se ignora por completo: el panel ya
//   no lo manda y, si lo mandara, no cambiaria el resultado.
app.put('/api/pedidos/:id/cancelar', requiereAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'El id del pedido no es válido' });

    let conn = null;
    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();

        const [filas] = await conn.query(
            'SELECT `estado`, `items`, `cupon_id`, `usuario_id`, `recompensas_usadas`, `recompensas_ganadas`, `recompensas_reversionadas` FROM `pedidos` WHERE `id_pedido` = ? FOR UPDATE',
            [id]
        );

        const pedido = filas[0];
        if (!pedido) {
            await conn.rollback();
            return res.status(404).json({ error: 'Ese pedido no existe' });
        }

        // Idempotencia: si ya estaba cancelado se avisa y NO se repone stock, que
        // es lo que pasaba antes con el segundo click del panel.
        if (pedido.estado === 'cancelado') {
            await conn.rollback();
            return res.status(409).json({ error: 'El pedido ya estaba cancelado' });
        }

        // Solo se cancela lo que esta 'pendiente'. 'finalizado' (el PUT
        // /api/pedidos/:id/finalizar de mas abajo) y 'entregado' son
        // terminales: la mercaderia ya salio del deposito, devolverla duplicaria
        // el inventario. Cualquier estado desconocido cae aca tambien, a
        // proposito: fail-safe, no se cancela lo que no se conoce.
        if (pedido.estado !== 'pendiente') {
            await conn.rollback();
            return res.status(409).json({ error: `No se puede cancelar un pedido en estado "${pedido.estado}"` });
        }

        // `items` es la foto de lo comprado. Se aceptan también los formatos de
        // pedidos antiguos (`id_vinilo`, `qty` y `vinilo.id`) para que cancelar
        // siempre reponga el stock que se descontó originalmente.
        let itemsPedido = [];
        try {
            const parseados = Array.isArray(pedido.items) ? pedido.items : JSON.parse(pedido.items || '[]');
            itemsPedido = Array.isArray(parseados) ? parseados : [];
        } catch {
            itemsPedido = [];
        }

        let stockRepuesto = 0;
        for (const item of itemsPedido) {
            const idVinilo = Number(item?.id ?? item?.id_vinilo ?? item?.vinilo?.id);
            const cantidad = Number(item?.cantidad ?? item?.qty ?? item?.quantity);
            if (!Number.isInteger(idVinilo) || idVinilo < 1) continue;
            if (!Number.isInteger(cantidad) || cantidad < 1) continue;
            await conn.query(
                'UPDATE `inventario_vinilos` SET `stock_actual` = `stock_actual` + ? WHERE `id` = ?',
                [cantidad, idVinilo]
            );
            stockRepuesto += cantidad;
        }

        // No se marca como cancelado un pedido cuyo snapshot no se pudo leer:
        // hacerlo dejaría la venta cancelada pero el inventario sin devolver.
        if (itemsPedido.length > 0 && stockRepuesto === 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'No se pudo leer el detalle del pedido para devolver el stock' });
        }

        // Contraparte del `usos_actuales + 1` del POST /api/pedidos: el uso se
        // devuelve para que un cupon no se agote con compras que ya no existen.
        // GREATEST(0, ...) porque la columna es NOT NULL pero un pedido viejo
        // puede tener el contador en 0 y bajarlo dejaria un -1. El `AND
        // uso_maximo IS NOT NULL` es a proposito y es la contraparte exacta del
        // incremento condicionado del POST: el contador solo se cuenta para
        // cupones con tope, asi que el reverso no tiene que tocar los que no lo
        // tienen (un cupon ilimitado nunca se incrementa, no hay nada que bajar;
        // y un pedido viejo de un cupon que despues se quedo sin limite no
        // deberia clavar el contador en -1... GREATEST ya lo evita, pero el
        // guard evita el UPDATE al pedo).
        if (pedido.cupon_id !== null && pedido.cupon_id !== undefined) {
            await conn.query(
                'UPDATE `cupones` SET `usos_actuales` = GREATEST(0, `usos_actuales` - 1) WHERE `id` = ? AND `uso_maximo` IS NOT NULL',
                [pedido.cupon_id]
            );
        }

        if (pedido.usuario_id) {
            const cuenta = await cuentaRecompensas(conn, pedido.usuario_id);
            const [consumos] = await conn.query(
                'SELECT c.`id`, c.`unidades`, c.`unidades_reversionadas` FROM `recompensas_consumos` c JOIN `recompensas_ledger` l ON l.`id` = c.`consumo_ledger_id` WHERE l.`pedido_id` = ? AND c.`usuario_id` = ? FOR UPDATE',
                [id, pedido.usuario_id]
            );
            const usadas = consumos.reduce((s, c) => s + Math.max(0, Number(c.unidades) - Number(c.unidades_reversionadas)), 0);
            if (usadas > 0) {
                for (const consumo of consumos) {
                    const pendientes = Math.max(0, Number(consumo.unidades) - Number(consumo.unidades_reversionadas));
                    if (pendientes > 0) await conn.query('UPDATE `recompensas_consumos` SET `unidades_reversionadas` = `unidades_reversionadas` + ? WHERE `id` = ?', [pendientes, consumo.id]);
                }
                await conn.query('UPDATE `recompensas_cuentas` SET `saldo` = `saldo` + ? WHERE `usuario_id` = ?', [usadas, pedido.usuario_id]);
                const reversionCanje = await movimientoRecompensas(conn, { usuarioId: pedido.usuario_id, tipo: 'reversion_canje', unidades: usadas, pedidoId: id, referencia: `pedido:${id}:reversion-canje`, referenciaTipo: 'pedido' });
                if (!reversionCanje.creado) {
                    await conn.rollback();
                    return res.status(409).json({ error: 'La reversión de Plumas ya estaba registrada' });
                }
            }
            const ganadas = Number(pedido.recompensas_ganadas || 0) - Number(pedido.recompensas_reversionadas || 0);
            if (ganadas > 0) {
                if (Number(cuenta.saldo) + usadas < ganadas) throw new ErrorPedido('No se puede revertir el premio porque el saldo ya fue consumido');
                await conn.query('UPDATE `recompensas_cuentas` SET `saldo` = `saldo` - ? WHERE `usuario_id` = ?', [ganadas, pedido.usuario_id]);
                const reversionGanancia = await movimientoRecompensas(conn, { usuarioId: pedido.usuario_id, tipo: 'reversion_ganancia', unidades: -ganadas, pedidoId: id, referencia: `pedido:${id}:reversion-ganancia`, referenciaTipo: 'pedido' });
                if (!reversionGanancia.creado) {
                    await conn.rollback();
                    return res.status(409).json({ error: 'La reversión de Plumas ya estaba registrada' });
                }
                await conn.query('UPDATE `pedidos` SET `recompensas_reversionadas` = ? WHERE `id_pedido` = ?', [ganadas, id]);
            }
        }

        await conn.query('UPDATE `pedidos` SET `estado` = ? WHERE `id_pedido` = ?', ['cancelado', id]);

        await conn.commit();
        res.json({ success: true, stock_repuesto: stockRepuesto });
    } catch (e) {
        // Si algo falla, el stock devuelto y el estado quedan como estaban: no
        // hay pedidos cancelados con la mercaderia repuesta dos veces.
        if (conn) await conn.rollback().catch(() => {});
        next(e);
    } finally {
        if (conn) conn.release();
    }
});

// --- FINALIZAR PEDIDO ---
// POR QUE CADA GUARDA EXISTE
//   La version anterior hacia un UPDATE ciego: no miraba el estado previo, no
//   chequeaba affectedRows y dejaba pasar ids no numericos. Consecuencias reales:
//   - Un pedido ya `cancelado` se podia "finalizar". Eso es un bug de plata: la
//     cancelacion ya devolvio el stock y el uso del cupon, asi que el cliente se
//     quedaba con la mercaderia y ademas con el cupon recuperado. Por eso aca,
//     como en /cancelar, el estado se lee con FOR UPDATE dentro de la
//     transaccion y se exige 'pendiente'.
//   - Un id inexistente devolvia `{success:true}` y el panel creia que guardo,
//     pero la fila nunca cambio. Por eso el SELECT primero y el 404.
//   - `id_pedido` es INT: un id no entero no puede matchear, y mejor un 400
//     claro que un UPDATE silencioso.
//   El UPDATE tambien exige `estado = 'pendiente'` como defensa en profundidad:
//   aunque el SELECT bajo lock ya valido el estado, la escritura no debe poder
//   cambiar un pedido terminal si esta garantia se modifica en el futuro.
app.put('/api/pedidos/:id/finalizar', requiereAdmin, async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'El id del pedido no es válido' });

    let conn = null;
    try {
        conn = await sql.getConnection();
        await conn.beginTransaction();

        // FOR UPDATE: el estado que se valida es el mismo que se escribe. Sin el
        // lock, dos admins podrian finalizar/cancelar a la vez y el segundo
        // fallaria recien despues de validar sobre una fila vieja.
        const [filas] = await conn.query(
            'SELECT `estado`, `usuario_id`, `total_pago`, `descuento_recompensas_usd`, `recompensas_ganadas` FROM `pedidos` WHERE `id_pedido` = ? FOR UPDATE',
            [id]
        );

        const pedido = filas[0];
        if (!pedido) {
            await conn.rollback();
            return res.status(404).json({ error: 'Ese pedido no existe' });
        }

        // Idempotencia: finalizar algo ya finalizado no es un error del panel,
        // es un doble click. Se avisa con 409 en vez de re-escribir el estado.
        if (pedido.estado === 'finalizado') {
            await conn.rollback();
            return res.status(409).json({ error: 'El pedido ya estaba finalizado' });
        }

        // El caso grave: un pedido cancelado NO se puede finalizar, porque la
        // cancelacion ya devolvio stock y uso del cupon y la mercaderia sigue en
        // manos del cliente. Cualquier estado que no sea 'pendiente' (incluidos
        // los desconocidos) falla igual, fail-safe: no se marca como finalizado
        // lo que no se sabe que esta en camino al deposito.
        if (pedido.estado === 'cancelado') {
            await conn.rollback();
            return res.status(409).json({ error: 'El pedido ya estaba cancelado, no se puede finalizar' });
        }
        if (pedido.estado !== 'pendiente') {
            await conn.rollback();
            return res.status(409).json({ error: `No se puede finalizar un pedido en estado "${pedido.estado}"` });
        }

        const [actualizacion] = await conn.query(
            'UPDATE `pedidos` SET `estado` = ? WHERE `id_pedido` = ? AND `estado` = ?',
            ['finalizado', id, 'pendiente']
        );
        if (actualizacion.affectedRows !== 1) {
            await conn.rollback();
            return res.status(409).json({ error: 'El pedido ya no está pendiente' });
        }

        let recompensasGanadas = Number(pedido.recompensas_ganadas || 0);
        if (pedido.usuario_id && recompensasGanadas === 0) {
            const netoCents = unidadesDesdeDolares(Number(pedido.total_pago) + Number(pedido.descuento_recompensas_usd || 0));
            recompensasGanadas = Math.floor(netoCents * PLUMAS_PORCENTAJE_PREMIO / 100);
            if (recompensasGanadas > 0) {
                await cuentaRecompensas(conn, pedido.usuario_id);
                const ganancia = await movimientoRecompensas(conn, { usuarioId: pedido.usuario_id, tipo: 'ganancia', unidades: recompensasGanadas, pedidoId: id, referencia: `pedido:${id}:ganancia`, referenciaTipo: 'pedido', expiraEn: true });
                if (!ganancia.creado) {
                    await conn.rollback();
                    return res.status(409).json({ error: 'La ganancia de Plumas ya estaba registrada' });
                }
                await conn.query('UPDATE `recompensas_cuentas` SET `saldo` = `saldo` + ? WHERE `usuario_id` = ?', [recompensasGanadas, pedido.usuario_id]);
                await conn.query('UPDATE `pedidos` SET `recompensas_ganadas` = ? WHERE `id_pedido` = ?', [recompensasGanadas, id]);
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (e) {
        // Si algo falla a mitad de camino, el estado queda como estaba: la
        // transaccion es todo o nada.
        if (conn) await conn.rollback().catch(() => {});
        next(e);
    } finally {
        if (conn) conn.release();
    }
});

// ==========================================
// 4. CUPONES
// ==========================================
// Cupones de descuento del carrito. Tabla `cupones` (db/migrations/2026-09-27_cupones.sql).
//
// CONTRATO
//   - El descuento NUNCA se calcula a partir de lo que manda el navegador: el
//     carrito usa POST /api/cupones/validar solo para mostrar el beneficio, y
//     el descuento real lo aplica POST /api/pedidos contra la base (seccion 3).
//   - `porcentaje`: descuenta valor% del subtotal (0-100). `fijo`: descuenta
//     valor en USD.
//   - Vencido: fecha_expiracion < hoy. Agotado: uso_maximo IS NOT NULL AND
//     usos_actuales >= uso_maximo. Los dos casos corren con la fecha de MySQL
//     (CURDATE), no con la del navegador.
//   - El alta/edicion/baja es del backoffice: ademas del `requiereAdmin`, el
//     gate CSRF por Origin de arriba ya frena los POST/PUT/DELETE de otra web.
//
// ESTILO
//   Esta seccion usa async/await con `sql` (el wrapper de promesas del pool)
//   porque el flujo de validacion + 409 + 201 en callbacks queda ilegible; es el
//   mismo criterio que usa auth.js.

// Los campos son los del tipo `Cupon` de src/types/database.ts: si se agrega una
// columna a la tabla hay que sumarla en los dos lados.
const CAMPOS_CUPON = '`id`, `codigo`, `tipo`, `valor`, `fecha_expiracion`, `activo`, `uso_maximo`, `usos_actuales`, `creado_en`';
// El listado del backoffice devuelve la fecha como YYYY-MM-DD en vez del DATETIME
// crudo: el panel la parsea como UTC y en Argentina (UTC-3) el valor crudo se ve
// un dia antes del real. Mismo criterio que la validacion del cupon del pedido.
const CAMPOS_CUPON_LISTADO = CAMPOS_CUPON.replace(
    '`fecha_expiracion`',
    "DATE_FORMAT(`fecha_expiracion`, '%Y-%m-%d') AS `fecha_expiracion`"
);
// Lo unico que sale de la validacion publica: lo que el carrito necesita para
// pintar el beneficio y mandarlo despues en el POST /api/pedidos. `uso_maximo` y
// `usos_actuales` son del backoffice (dicen cuantos usos le quedan) y no se
// exponen: ademas de ser interno, verlos ayuda a sondear el catalogo de cupones.
const CAMPOS_CUPON_PUBLICO = '`id`, `codigo`, `tipo`, `valor`';
const TIPOS_CUPON = ['porcentaje', 'fijo'];
// Sin espacios ni acentos en el codigo: el cliente lo escribe a mano y lo
// mandamos en mayusculas, asi que el formato se acota a [A-Z0-9_-].
const RE_CODIGO_CUPON = /^[A-Z0-9_-]+$/;
const RE_FECHA_CUPON = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida y normaliza el cuerpo de un cupon.
 * @param {any} body               cuerpo crudo de la request
 * @param {{ parcial: boolean, actual?: any }} opciones
 *   - parcial=false (POST): codigo, tipo y valor son obligatorios.
 *   - parcial=true  (PUT): solo se mira lo que viene. `actual` es la fila ya
 *     guardada y se usa para conocer el tipo vigente al validar un `valor` suelto.
 * @returns {{ ok: true, datos: Record<string, any> } | { ok: false, mensaje: string }}
 */
function validarCupon(body, { parcial, actual = null }) {
    const b = body && typeof body === 'object' ? body : {};
    const viene = (clave) => Object.prototype.hasOwnProperty.call(b, clave);
    const datos = {};

    // codigo: a mayusculas, sin espacios, max 50 (VARCHAR(50)).
    if (!parcial || viene('codigo')) {
        const codigo = String(b.codigo ?? '').trim().toUpperCase();
        if (!codigo) return { ok: false, mensaje: 'El código del cupón no puede estar vacío' };
        if (codigo.length > 50) return { ok: false, mensaje: 'El código no puede tener más de 50 caracteres' };
        if (!RE_CODIGO_CUPON.test(codigo)) {
            return { ok: false, mensaje: 'El código solo admite letras, números, guion y guion bajo' };
        }
        datos.codigo = codigo;
    }

    if (!parcial || viene('tipo')) {
        const tipo = String(b.tipo ?? '').trim().toLowerCase();
        if (!TIPOS_CUPON.includes(tipo)) return { ok: false, mensaje: 'El tipo tiene que ser "porcentaje" o "fijo"' };
        datos.tipo = tipo;
    }

    // valor: > 0 siempre, y <= 100 si el tipo (nuevo o ya guardado) es porcentaje.
    // Number('') y Number(null) dan 0, asi que un input vacio cae en el error.
    if (!parcial || viene('valor')) {
        const valor = Number(b.valor);
        if (!Number.isFinite(valor) || valor <= 0) return { ok: false, mensaje: 'El valor tiene que ser un número mayor a 0' };
        const tipoVigente = datos.tipo || (actual ? String(actual.tipo) : '');
        if (tipoVigente === 'porcentaje' && valor > 100) {
            return { ok: false, mensaje: 'Un cupón de porcentaje no puede ser mayor a 100' };
        }
        datos.valor = Math.round(valor * 100) / 100;
    }

    // uso_maximo y fecha_expiracion aceptan '' (input vacio del panel) = NULL = sin limite.
    if (!parcial || viene('uso_maximo')) {
        const bruto = b.uso_maximo;
        if (bruto === '' || bruto === null || bruto === undefined) {
            datos.uso_maximo = null;
        } else {
            const usos = Number(bruto);
            if (!Number.isInteger(usos) || usos < 1) {
                return { ok: false, mensaje: 'El uso máximo tiene que ser un entero mayor o igual a 1' };
            }
            datos.uso_maximo = usos;
        }
    }

    if (!parcial || viene('fecha_expiracion')) {
        const bruto = b.fecha_expiracion;
        if (bruto === '' || bruto === null || bruto === undefined) {
            datos.fecha_expiracion = null;
        } else {
            const fecha = String(bruto).trim();
            // El regex mas Date.parse: 2026-02-31 pasa el regex pero no existe.
            if (!RE_FECHA_CUPON.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
                return { ok: false, mensaje: 'La fecha de expiración tiene que tener formato YYYY-MM-DD' };
            }
            datos.fecha_expiracion = fecha;
        }
    }

    // usos_actuales: solo en el PUT parcial. Es el contador que mueve el POST
    // /api/pedidos, asi que el alta lo deja en 0 y no se valida ahi; el panel lo
    // necesita para corregir un contador a mano (un cupon "agotado" que en
    // realidad se uso poco, o al rearmar una promo). Antes la lista cerrada de
    // claves lo ignoraba y la unica forma de revivir el cupon era borrarlo,
    // perdiendo el historico de usos.
    if (parcial && viene('usos_actuales')) {
        const bruto = b.usos_actuales;
        // ''/null es el input vacio del panel y significa "no lo toques": si
        // fuera 0 en silencio, un null reiniciaria el contador de cualquier
        // cliente que mande el formulario entero.
        if (bruto !== '' && bruto !== null && bruto !== undefined) {
            const usos = Number(bruto);
            if (!Number.isInteger(usos) || usos < 0) {
                return { ok: false, mensaje: 'Los usos actuales tienen que ser un entero mayor o igual a 0' };
            }
            // Un cupon no puede tener mas usos consumidos que los permitidos:
            // dejaria el contador en un estado que la validacion del carrito
            // jamas podria alcanzar. El tope que se compara es el EFECTIVO de
            // esta edicion: el `uso_maximo` del body si viene (el panel manda
            // los dos campos juntos y el tope nuevo es el que se esta
            // escribiendo), y si no, el que ya esta guardado en la fila que el
            // handler leyo de la base. Antes solo se comparaba contra el del
            // body, asi que un PUT { usos_actuales: 9999 } sobre un cupon con
            // tope 10 no validaba nada y lo dejaba permanentemente agotado.
            // `tope === null` (o sin fila) es cupon ILIMITADO: sin tope no hay
            // invariante que romper y cualquier contador es valido.
            const tope = datos.uso_maximo !== undefined
                ? datos.uso_maximo
                : (actual ? (actual.uso_maximo === null || actual.uso_maximo === undefined ? null : Number(actual.uso_maximo)) : null);
            if (tope !== null && Number.isFinite(Number(tope)) && usos > Number(tope)) {
                return { ok: false, mensaje: 'Los usos actuales no pueden ser mayores que el uso máximo del cupón' };
            }
            datos.usos_actuales = usos;
        }
    }

    // activo: el panel lo manda como booleano; la base lo guarda como 0/1.
    if (viene('activo')) {
        if (b.activo === true || b.activo === 1 || b.activo === '1') datos.activo = 1;
        else if (b.activo === false || b.activo === 0 || b.activo === '0') datos.activo = 0;
        else return { ok: false, mensaje: 'El estado del cupón tiene que ser 0 (inactivo) o 1 (activo)' };
    }

    return { ok: true, datos };
}

// --- RATE LIMIT DE /api/cupones/validar ---
// POR QUE EXISTE
//   La ruta es publica y no exige sesion, asi que sin throttle cualquiera puede
//   probar codigos en boucle y quedarse con el catalogo entero: el unico dato
//   que distingue un acierto (200) de un fallo (400) es si el cupon existe,
//   esta activo y le queda margen. Mismo criterio, mismo mecanismo y misma idea
//   que el login (auth.js) y que el rate limit de /api/pedidos: se crea aca una
//   instancia del limitador compartido, y el 429 va con el texto de siempre
//   porque el carrito lo usa para distinguir "esperá" de "tu cupón no sirve".
//
// POR QUE LA CUOTA LA GASTA SOLO EL ERROR
//   El contador se subia ANTES de validar, asi que tambien pagaban las
//   validaciones correctas. Y el carrito revalida el cupon cada vez que monta
//   el carrito o vuelve de la navegacion, o sea que el uso legitimo es
//   justamente el mas frecuente: un cliente normal se comia la cuota y le caia
//   el cupon del carrito. Un acierto no es un intento de adivinar nada, asi que
//   no se cuenta: la cuota mide intentos fallidos, que es lo que frena el
//   sondeo de codigos.
//
// POR QUE 60 Y NO 20, Y POR QUE EL TECHO NO SALVA DEL CGNAT
//   El limite es por IP y en Argentina los operadores moviles usan CGNAT: una
//   sola IPv4 publica la comparten decenas o cientos de personas, y un local con
//   un solo enlace parece una IP sola. Con 20, se caian entre todos los que
//   comparten esa IPv4. 60 deja margen de sobra para el uso real de un
//   hogar (validar el mismo cupon al montar el carrito, en cada producto) y
//   sigue siendo un freno: recorrer un catalogo de cupones a 6 intentos por
//   minuto es inviable. El limite por IP no puede ser perfecto con CGNAT (no se
//   distingue familia de abusivo sin sesion); por eso el techo es alto y el que
//   frena de verdad el oraculo es el unico mensaje de error, no el 429.
const MAX_VALIDACIONES_POR_IP = 60;
const VENTANA_VALIDACION_MS = 10 * 60 * 1000;
const TEXTO_429_CUPON = 'Demasiados intentos de cupón. Probá de nuevo en unos minutos.';
const rateLimitValidarCupon = crearRateLimitPorIP({
    max: MAX_VALIDACIONES_POR_IP,
    ventanaMs: VENTANA_VALIDACION_MS,
    texto429: TEXTO_429_CUPON,
    // El consumo de cuota vive en el camino de error, no en el middleware.
    soloFallos: true
});

// --- Validar un cupon (publico) ---
// No exige sesion: el carrito la llama antes de que el cliente haya hecho nada.
// Un mismo 400 para inexistente / inactivo / vencido / agotado, para no poder
// sondear que codigos existen, y un rate limit por IP porque sin sesion no hay
// quien frene los intentos.
app.post('/api/cupones/validar', rateLimitValidarCupon.middleware, (req, res, next) => {
    const codigo = String(req.body?.codigo ?? '').trim().toUpperCase();
    // Un codigo vacio NO consume cuota: no es un intento de adivinar nada (no
    // mira la base, no puede revelar nada) y el carrito lo manda en consultas
    // mal tipeadas que no tienen nada de sostenido.
    const invalido = () => {
        if (codigo && rateLimitValidarCupon.contarFallo(req, res)) return;
        res.status(400).json({ error: 'Cupón inválido o vencido' });
    };
    if (!codigo) return invalido();

    db.query(
        `SELECT ${CAMPOS_CUPON_PUBLICO}
           FROM \`cupones\`
          WHERE UPPER(\`codigo\`) = ?
            AND \`activo\` = 1
            AND (\`fecha_expiracion\` IS NULL OR \`fecha_expiracion\` >= CURDATE())
            AND (\`uso_maximo\` IS NULL OR \`usos_actuales\` < \`uso_maximo\`)
          LIMIT 1`,
        [codigo],
        (err, filas) => {
            // El error de MySQL no se devuelve al cliente: lo responde el error
            // handler del final, que no filtra nombres de tablas ni de columnas.
            if (err) return next(err);
            if (!filas[0]) return invalido();
            // Se arma la respuesta a mano (y no se devuelve la fila) para que el
            // contrato con el carrito sea explicito: si mañana se cuela una
            // columna en la lista del SELECT, no sale de la API sin querer.
            const cupon = filas[0];
            res.json({
                id: cupon.id,
                codigo: cupon.codigo,
                tipo: cupon.tipo,
                valor: cupon.valor
            });
        }
    );
});

// --- Listar cupones (backoffice) ---
// Primero los activos y, dentro de ellos, los que vencen antes; los sin fecha
// (NULL) van al final porque `fecha_expiracion IS NULL` ordena 0 antes que 1.
// Devuelve `creado_en` (la usa el panel para ordenar/mostrar cuando se creo) y
// la fecha ya formateada, por el tema del UTC que aclaro CAMPOS_CUPON_LISTADO.
app.get('/api/admin/cupones', requiereAdmin, (req, res, next) => {
    db.query(
        `SELECT ${CAMPOS_CUPON_LISTADO}
           FROM \`cupones\`
          ORDER BY \`activo\` DESC, \`fecha_expiracion\` IS NULL, \`fecha_expiracion\` ASC, \`id\` DESC`,
        (err, results) => {
            if (err) return next(err);
            res.json(results || []);
        }
    );
});

app.post('/api/admin/cupones', requiereAdmin, async (req, res, next) => {
    try {
        const validacion = validarCupon(req.body, { parcial: false });
        if (!validacion.ok) return res.status(400).json({ error: validacion.mensaje });

        const { codigo, tipo, valor, fecha_expiracion, uso_maximo } = validacion.datos;
        // activo = 1 salvo que el panel lo mande explícito; usos_actuales arranca en 0.
        const activo = validacion.datos.activo ?? 1;

        // Chequeo previo para poder responder 409 con un mensaje claro. La garantia
        // real sigue siendo el UNIQUE de `codigo`: si dos admins crean el mismo
        // codigo a la vez, el ER_DUP_ENTRY lo responde el error handler del final.
        const [existentes] = await sql.query('SELECT `id` FROM `cupones` WHERE UPPER(`codigo`) = ? LIMIT 1', [codigo]);
        if (existentes.length > 0) return res.status(409).json({ error: 'Ese código ya existe' });

        const [resultado] = await sql.query(
            'INSERT INTO `cupones` (`codigo`, `tipo`, `valor`, `fecha_expiracion`, `activo`, `uso_maximo`, `usos_actuales`) VALUES (?, ?, ?, ?, ?, ?, 0)',
            [codigo, tipo, valor, fecha_expiracion, activo, uso_maximo]
        );

        // Se devuelve con CAMPOS_CUPON_LISTADO (lo mismo que el listado) para que la
        // fecha_expiración llegue formateada: el panel consume la respuesta de
        // este POST como si fuera una fila del GET /admin/cupones, y la cruda le
        // daria un dia de menos por el UTC del navegador.
        const [filas] = await sql.query(`SELECT ${CAMPOS_CUPON_LISTADO} FROM \`cupones\` WHERE \`id\` = ?`, [resultado.insertId]);
        res.status(201).json(filas[0]);
    } catch (e) {
        next(e);
    }
});

// --- Editar cupon (backoffice) ---
// parcial: solo se tocan los campos que vienen. Es lo que usa el panel para
// activar/desactivar (PUT con { activo: 0 }) sin pisar el resto.
app.put('/api/admin/cupones/:id', requiereAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id inválido' });

        const [actuales] = await sql.query(`SELECT ${CAMPOS_CUPON_LISTADO} FROM \`cupones\` WHERE \`id\` = ?`, [id]);
        const actual = actuales[0];
        if (!actual) return res.status(404).json({ error: 'Ese cupón no existe' });

        const validacion = validarCupon(req.body, { parcial: true, actual });
        if (!validacion.ok) return res.status(400).json({ error: validacion.mensaje });

        const claves = Object.keys(validacion.datos);
        if (claves.length === 0) return res.status(400).json({ error: 'No mandaste ningún campo para actualizar' });

        // UPPER() para no chocar contra si mismo si reenvian el mismo codigo.
        if (validacion.datos.codigo && validacion.datos.codigo !== actual.codigo) {
            const [duplicados] = await sql.query(
                'SELECT `id` FROM `cupones` WHERE UPPER(`codigo`) = ? AND `id` <> ? LIMIT 1',
                [validacion.datos.codigo, id]
            );
            if (duplicados.length > 0) return res.status(409).json({ error: 'Ese código ya existe' });
        }

        // Las claves salen de validarCupon (lista cerrada), no del request. Por
        // eso `usos_actuales` se escribe sin ninguna rama extra acá: si
        // validarCupon lo acepta, entra en el UPDATE.
        const sets = claves.map(clave => `\`${clave}\` = ?`).join(', ');
        await sql.query(
            `UPDATE \`cupones\` SET ${sets} WHERE \`id\` = ?`,
            [...claves.map(clave => validacion.datos[clave]), id]
        );

        const [filas] = await sql.query(`SELECT ${CAMPOS_CUPON_LISTADO} FROM \`cupones\` WHERE \`id\` = ?`, [id]);
        res.json(filas[0]);
    } catch (e) {
        next(e);
    }
});

app.delete('/api/admin/cupones/:id', requiereAdminMaximo, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id inválido' });

        const [resultado] = await sql.query('DELETE FROM `cupones` WHERE `id` = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Ese cupón no existe' });
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// ==========================================
// 5. ERRORES
// ==========================================
// Unico lugar donde muere un error interno: los handlers de server.js y de
// auth.js reenvian con next(err). Sin esto el cliente se queda colgado sin
// respuesta cuando algo falla (duplicados, FKs, etc).
app.use((err, req, res, next) => {
    // Si ya se mando una cabecera (un stream, un sendFile) no se puede cambiar
    // el status: se corta la conexion y que el cliente detecte el fallo.
    if (res.headersSent) return next(err);
    // Se loguea el error COMPLETO, con su stack: ahora que todas las rutas
    // internas terminan aca, el mensaje solo ("Table 'x' doesn't exist") no dice
    // en que handler se rompió. El stack nunca sale de la consola.
    console.error(`Error no controlado en ${req.method} ${req.originalUrl}:`, err);

    // Los dos casos que si se traducen a un mensaje propio: son errores de
    // negocio que el frontend muestra tal cual y no filtran nada de la base.
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese registro ya existe' });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Referencia invalida' });
    // Cualquier otro: 500 con texto generico. El detalle (nombres de tabla,
    // columnas, host, usuario de MySQL) se queda en el log de arriba.
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Puerto ${PORT}`));
