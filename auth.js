// ==========================================
// AUTENTICACION (backoffice + clientes)
// ==========================================
// Donde vive toda la logica de cuentas: hashing de contrasenas, sesiones con
// token opaco, cookies httpOnly y los endpoints /api/admin/* y /api/auth/*.
//
// DECISIONES
//   - Contrasenas: scrypt (node:crypto, sin dependencias). El hash guardado es
//     "scrypt$N$r$p$salt$hash" en hex; la verificacion usa timingSafeEqual.
//     verificarPassword devuelve false (no revienta) ante un hash de otro
//     formato: para cambiar de algoritmo habria que sumar la rama nueva y
//     rehashear los passwords en el login.
//   - Sesiones: tabla `sesiones`. El token en claro (32 bytes, base64url) solo
//     viaja en la cookie httpOnly; en la BD queda unicamente su SHA-256, asi
//     que filtrar la BD no permite suplantar sesiones.
//   - Cookies: httpOnly + SameSite=Lax + Secure en produccion. El frontend
//     tiene que mandar credentials:'include' y el CORS no puede ser '*'.
//   - Sin JWT: las sesiones se pueden revocar (logout) desde la BD, que es lo
//     que hace falta para un panel de administracion.
//
// Rutas montadas desde server.js con:
//   app.use('/api', crearAuthRouter(db));
// ==========================================
import express from 'express';
import crypto from 'crypto';

// --- Constantes de sesion ---
const COOKIE_ADMIN = 'gr_admin';
const COOKIE_CLIENTE = 'gr_cliente';
const HORAS_SESION_ADMIN = 12;
const DIAS_SESION_CLIENTE = 30;
const MINUTOS_ACTIVIDAD_ADMIN = 1;   // lock de sesion unica (423)
const MAX_INTENTOS = 5;               // intentos fallidos por email+ip
const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;
const ES_PROD = process.env.NODE_ENV === 'production';

// scrypt: N=16384, r=8, p=1 -> ~16 MB por hash, 64 bytes de salida.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

// Map de intentos fallidos: "email|ip" -> { count, hasta }
const intentos = new Map();

// ==========================================
// HELPERS DE CONTRASENA Y TOKEN
// ==========================================

/** Devuelve "scrypt$N$r$p$saltHex$hashHex" (cabalen < 255, cabe en VARCHAR). */
export function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
    return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('hex'), hash.toString('hex')].join('$');
}

/** Compara en tiempo constante. False si el hash guardado no tiene el formato. */
export function verificarPassword(password, guardado) {
    if (typeof password !== 'string' || typeof guardado !== 'string') return false;
    const partes = guardado.split('$');
    if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

    const [, n, r, p, saltHex, hashHex] = partes;
    const esperado = Buffer.from(hashHex, 'hex');
    if (esperado.length === 0) return false;

    let calculado;
    try {
        calculado = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), esperado.length, {
            N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem
        });
    } catch {
        return false;
    }
    return crypto.timingSafeEqual(esperado, calculado);
}

const nuevoToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ==========================================
// HELPERS DE COOKIE / REQUEST
// ==========================================

/** Parser minimo de cookies (evita la dependencia cookie-parser). */
export function leerCookies(req) {
    const cookies = {};
    const cabecera = req.headers.cookie;
    if (!cabecera) return cookies;
    for (const parte of cabecera.split(';')) {
        const corte = parte.indexOf('=');
        if (corte < 0) continue;
        const clave = parte.slice(0, corte).trim();
        if (!clave) continue;
        try {
            cookies[clave] = decodeURIComponent(parte.slice(corte + 1).trim());
        } catch {
            cookies[clave] = parte.slice(corte + 1).trim();
        }
    }
    return cookies;
}

const nombreCookie = (tipo) => (tipo === 'admin' ? COOKIE_ADMIN : COOKIE_CLIENTE);

const opcionesCookieBase = () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: ES_PROD,
    path: '/'
});

const ponerCookie = (res, tipo, token) => {
    const maxAge = tipo === 'admin'
        ? HORAS_SESION_ADMIN * 3600 * 1000
        : DIAS_SESION_CLIENTE * 24 * 3600 * 1000;
    res.cookie(nombreCookie(tipo), token, { ...opcionesCookieBase(), maxAge });
};

const borrarCookie = (res, tipo) => {
    res.clearCookie(nombreCookie(tipo), opcionesCookieBase());
};

const ipDe = (req) => (req.ip || req.socket?.remoteAddress || '').slice(0, 45);
const userAgentDe = (req) => String(req.headers['user-agent'] || '').slice(0, 255);

// ==========================================
// RATE LIMIT DE INTENTOS (en memoria)
// ==========================================

/** Techo de claves vivas: un atacante que rota emails no puede inflar el Map. */
const MAX_CLAVES_INTENTO = 5000;

function claveIntento(req, email) {
    return `${String(email || '').toLowerCase()}|${ipDe(req)}`;
}

function estaBloqueado(clave) {
    const registro = intentos.get(clave);
    if (!registro) return false;
    if (Date.now() > registro.hasta) { intentos.delete(clave); return false; }
    return registro.count >= MAX_INTENTOS;
}

function registrarFallo(clave) {
    const ahora = Date.now();
    const registro = intentos.get(clave);
    if (!registro || ahora - registro.ventana > VENTANA_INTENTOS_MS) {
        if (intentos.size >= MAX_CLAVES_INTENTO) {
            // Se descarta la m??s vieja en vez de crecer sin l??mite.
            const [masVieja] = intentos.keys();
            intentos.delete(masVieja);
        }
        intentos.set(clave, { count: 1, ventana: ahora, hasta: ahora + BLOQUEO_MS });
        return;
    }
    registro.count += 1;
    registro.hasta = ahora + BLOQUEO_MS;
}

const limpiarIntentos = (clave) => intentos.delete(clave);

/** Barro de claves vencidas. Lo llama el interval de limpieza de server.js. */
export function purgarIntentos() {
    const ahora = Date.now();
    for (const [clave, registro] of intentos) {
        if (ahora > registro.hasta) intentos.delete(clave);
    }
}

// Hash se??uelo: sin esto, un email inexistente responde en ~0 ms y uno existente
// tarda el scrypt completo, as?? que el tiempo de respuesta revela qu?? emails hay.
let hashSenaluelo = null;
const verificarContraSenaluelo = (password) => {
    if (!hashSenaluelo) hashSenaluelo = hashPassword('__guacamayo_clave_senaluelo__');
    verificarPassword(password, hashSenaluelo);
    return false;
};

// ==========================================
// SESIONES
// ==========================================

async function crearSesion(sql, req, { tipo, adminUsuarioId = null, usuarioId = null }) {
    const token = nuevoToken();
    const horas = tipo === 'admin' ? HORAS_SESION_ADMIN : DIAS_SESION_CLIENTE * 24;
    await sql.query(
        `INSERT INTO \`sesiones\`
            (\`token_hash\`, \`tipo\`, \`admin_usuario_id\`, \`usuario_id\`, \`expira_en\`, \`ip\`, \`user_agent\`)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?)`,
        [hashToken(token), tipo, adminUsuarioId, usuarioId, horas, ipDe(req), userAgentDe(req)]
    );
    return token;
}

async function borrarSesion(sql, req, tipo) {
    const token = leerCookies(req)[nombreCookie(tipo)];
    if (token) await sql.query('DELETE FROM `sesiones` WHERE `token_hash` = ?', [hashToken(token)]);
}

/**
 * Devuelve la sesion viva del tipo pedido o null.
 * Toca `ultima_actividad` en cada lectura: de ahi sale el lock de sesion unica.
 */
async function leerSesion(sql, req, tipo) {
    const token = leerCookies(req)[nombreCookie(tipo)];
    if (!token) return null;

    const [filas] = await sql.query(
        `SELECT s.\`id\`                AS sesion_id,
                s.\`ultima_actividad\` AS ultima_actividad,
                a.\`id\`     AS admin_id, a.\`email\` AS admin_email,
                a.\`nombre\` AS admin_nombre, a.\`rol\` AS admin_rol,
                u.\`id\`     AS usuario_id, u.\`email\` AS usuario_email,
                u.\`nombre\` AS usuario_nombre, u.\`telefono\` AS usuario_telefono,
                u.\`avatar_url\` AS usuario_avatar
           FROM \`sesiones\` s
           LEFT JOIN \`admin_usuarios\` a ON a.\`id\` = s.\`admin_usuario_id\`
           LEFT JOIN \`usuarios\` u ON u.\`id\` = s.\`usuario_id\`
          WHERE s.\`token_hash\` = ?
            AND s.\`tipo\` = ?
            AND s.\`expira_en\` > NOW()
            AND (s.\`tipo\` <> 'admin'   OR a.\`activo\` = 1)
            AND (s.\`tipo\` <> 'cliente' OR u.\`activo\` = 1)
          LIMIT 1`,
        [hashToken(token), tipo]
    );

    const sesion = filas[0];
    if (!sesion) return null;

    await sql.query('UPDATE `sesiones` SET `ultima_actividad` = NOW() WHERE `id` = ?', [sesion.sesion_id]);
    return sesion;
}

const datosAdmin = (sesion) => sesion && ({
    id: sesion.admin_id,
    email: sesion.admin_email,
    nombre: sesion.admin_nombre,
    rol: sesion.admin_rol
});

const datosUsuario = (sesion) => sesion && ({
    id: sesion.usuario_id,
    email: sesion.usuario_email,
    nombre: sesion.usuario_nombre,
    telefono: sesion.usuario_telefono,
    avatar_url: sesion.usuario_avatar
});

// ==========================================
// MIDDLEWARES
// ==========================================

/** Exige sesion de backoffice. Deja req.auth = { tipo:'admin', admin }. */
function requiereAdmin(sql) {
    return (req, res, next) => {
        leerSesion(sql, req, 'admin')
            .then((sesion) => {
                if (!sesion) return res.status(401).json({ error: 'Sesion no valida' });
                req.auth = { tipo: 'admin', sesion, admin: datosAdmin(sesion) };
                next();
            })
            .catch(next);
    };
}

/** Exige sesion de cliente. Deja req.auth = { tipo:'cliente', usuario }. */
function requiereCliente(sql) {
    return (req, res, next) => {
        leerSesion(sql, req, 'cliente')
            .then((sesion) => {
                if (!sesion) return res.status(401).json({ error: 'Necesitas iniciar sesion' });
                req.auth = { tipo: 'cliente', sesion, usuario: datosUsuario(sesion) };
                next();
            })
            .catch(next);
    };
}

/** Session opcional: no bloquea, solo sirve para saber si hay que auditar. */
function sesionOpcional(sql, tipo) {
    return (req, res, next) => {
        leerSesion(sql, req, tipo)
            .then((sesion) => {
                req.auth = sesion
                    ? (tipo === 'admin'
                        ? { tipo: 'admin', sesion, admin: datosAdmin(sesion) }
                        : { tipo: 'cliente', sesion, usuario: datosUsuario(sesion) })
                    : null;
                next();
            })
            // Se sigue como invitado (fall-open: una compra sin sesion tiene que
            // poder igual) pero el motivo se loguea: si MySQL esta ca??do esto
            // degrada el pedido a compra de invitado sin que nadie se entere.
            .catch((e) => {
                console.error(`No se pudo leer la sesi??n (${tipo}):`, e);
                req.auth = null;
                next();
            });
    };
}

// ==========================================
// VALIDACION BASICA
// ==========================================

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const esEmail = (valor) => typeof valor === 'string' && RE_EMAIL.test(valor.trim());

const limpiar = (valor, max) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');

// Un poco de anti-enumeracion: mismo texto para email inexistente y clave mala.
const ERROR_CREDENCIALES = 'Credenciales incorrectas';

// ==========================================
// GOOGLE (verificacion del id_token contra Google)
// ==========================================

/**
 * Error de validacion de Google. Solo estos mensajes llegan al cliente: los
 * errores de MySQL o de red van al error handler generico de server.js.
 */
class ErrorGoogle extends Error {
    constructor(mensaje) {
        super(mensaje);
        this.name = 'ErrorGoogle';
    }
}

/**
 * Verifica el id_token de Google consultando su tokeninfo (server -> server).
 * Devuelve { email, googleId, nombre, avatar } o lanza Error.
 */
async function verificarGoogle(idToken) {
    if (typeof idToken !== 'string' || idToken.length < 20) throw new ErrorGoogle('Token de Google invalido');

    const respuesta = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!respuesta.ok) throw new ErrorGoogle('Token de Google invalido');

    const info = await respuesta.json();

    // aud debe ser la app que pedimos, si la tenemos configurada.
    if (process.env.GOOGLE_CLIENT_ID && info.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new ErrorGoogle('Token emitido para otra aplicacion');
    }
    if (info.email_verified !== 'true') throw new ErrorGoogle('El email de Google no esta verificado');
    if (!esEmail(info.email)) throw new ErrorGoogle('Google no devolvio un email valido');

    // Opcional: restringir a una organizacion (ej. GOOGLE_DOMINIOS=midominio.com).
    if (process.env.GOOGLE_DOMINIOS) {
        const permitidos = process.env.GOOGLE_DOMINIOS.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        const dominio = String(info.email).toLowerCase().split('@')[1];
        if (!permitidos.includes(dominio)) throw new ErrorGoogle('Dominio de Google no permitido');
    }

    return {
        email: info.email.trim().toLowerCase(),
        googleId: String(info.sub),
        nombre: limpiar(info.name, 120) || String(info.email).split('@')[0],
        avatar: limpiar(info.picture, 500) || null
    };
}

// ==========================================
// ROUTER
// ==========================================

/**
 * @param {import('mysql2/promise').Pool} db  pool de MySQL (se crea desde el
 *        pool callback con db.promise()).
 * @returns {import('express').Router}
 */
export function crearAuthRouter(db) {
    const sql = db.promise();
    const router = express.Router();
    const soloAdmin = requiereAdmin(sql);
    const soloCliente = requiereCliente(sql);

    // --------------------------------------------------------------
    // 0) Sesion actual (util para el frontend: "??estoy logueado?")
    // --------------------------------------------------------------
    router.get('/admin/yo', soloAdmin, (req, res) => {
        res.json({ admin: req.auth.admin });
    });

    router.get('/auth/yo', soloCliente, (req, res) => {
        res.json({ usuario: req.auth.usuario });
    });

    // --------------------------------------------------------------
    // 1) BACKOFFICE
    // --------------------------------------------------------------
    router.post('/admin/login', async (req, res, next) => {
        try {
            const email = limpiar(req.body?.email, 191);
            const password = req.body?.password;

            if (!email || typeof password !== 'string' || password.length === 0) {
                return res.status(400).json({ error: 'Falta email o contrasena' });
            }

            const clave = claveIntento(req, email);
            if (estaBloqueado(clave)) {
                return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
            }

            const [filas] = await sql.query(
                'SELECT `id`, `email`, `nombre`, `password_hash`, `rol`, `activo` FROM `admin_usuarios` WHERE LOWER(`email`) = ? LIMIT 1',
                [email.toLowerCase()]
            );
            const admin = filas[0];

            // Mismo costo (scrypt) exista o no el email: el tiempo de respuesta
            // no puede delatar qu?? cuentas existen.
            const passwordOk = admin
                ? verificarPassword(password, admin.password_hash)
                : verificarContraSenaluelo(password);

            if (!passwordOk) {
                registrarFallo(clave);
                return res.status(401).json({ error: ERROR_CREDENCIALES });
            }
            if (!admin.activo) return res.status(403).json({ error: 'Cuenta desactivada' });

            // Sesion unica: si otro dispositivo esta activo hace menos de
            // MINUTOS_ACTIVIDAD_ADMIN, no se permite el segundo ingreso.
            const [activas] = await sql.query(
                `SELECT COUNT(*) AS \`total\`
                   FROM \`sesiones\`
                  WHERE \`tipo\` = 'admin'
                    AND \`admin_usuario_id\` = ?
                    AND \`expira_en\` > NOW()
                    AND \`ultima_actividad\` > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
                [admin.id, MINUTOS_ACTIVIDAD_ADMIN]
            );
            if (activas[0].total > 0) {
                return res.status(423).json({
                    error: 'BLOQUEADO',
                    message: 'El panel ya esta abierto en otro dispositivo.'
                });
            }

            const token = await crearSesion(sql, req, { tipo: 'admin', adminUsuarioId: admin.id });

            // Sesion unica de verdad: las sesiones viejas que quedaron sin
            // actividad se borran, asi una cookie de una pestana cerrada no
            // sirve para escribir en el backoffice durante las 12 h del TTL.
            await sql.query(
                'DELETE FROM `sesiones` WHERE `tipo` = \'admin\' AND `admin_usuario_id` = ? AND `ultima_actividad` <= DATE_SUB(NOW(), INTERVAL ? MINUTE)',
                [admin.id, MINUTOS_ACTIVIDAD_ADMIN]
            );

            await sql.query('UPDATE `admin_usuarios` SET `ultimo_acceso` = NOW() WHERE `id` = ?', [admin.id]);
            limpiarIntentos(clave);
            ponerCookie(res, 'admin', token);

            res.json({
                admin: { id: admin.id, email: admin.email, nombre: admin.nombre, rol: admin.rol }
            });
        } catch (e) {
            next(e);
        }
    });

    router.post('/admin/logout', async (req, res, next) => {
        try {
            await borrarSesion(sql, req, 'admin');
            borrarCookie(res, 'admin');
            res.json({ success: true });
        } catch (e) {
            next(e);
        }
    });

    // Heartbeat: el panel lo llama cada 15 s. Ademas de refrescar la actividad,
    // avisa al frontend cuando la sesion murio en el servidor.
    router.post('/admin/heartbeat', soloAdmin, (req, res) => {
        res.json({ status: 'alive' });
    });

    // --------------------------------------------------------------
    // 2) CLIENTES: registro, login, Google, logout
    // --------------------------------------------------------------
    router.post('/auth/registro', async (req, res, next) => {
        try {
            const nombre = limpiar(req.body?.nombre, 120);
            const email = limpiar(req.body?.email, 191).toLowerCase();
            const password = req.body?.password;
            const telefono = limpiar(req.body?.telefono, 32) || null;

            if (nombre.length < 2) return res.status(400).json({ error: 'Escribi tu nombre' });
            if (!esEmail(email)) return res.status(400).json({ error: 'El email no es valido' });
            if (typeof password !== 'string' || password.length < 8) {
                return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
            }

            const [existe] = await sql.query('SELECT `id` FROM `usuarios` WHERE LOWER(`email`) = ? LIMIT 1', [email]);
            if (existe.length > 0) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

            const [resultado] = await sql.query(
                'INSERT INTO `usuarios` (`email`, `nombre`, `telefono`, `password_hash`) VALUES (?, ?, ?, ?)',
                [email, nombre, telefono, hashPassword(password)]
            );

            const usuarioId = resultado.insertId;
            const token = await crearSesion(sql, req, { tipo: 'cliente', usuarioId });
            ponerCookie(res, 'cliente', token);

            res.status(201).json({ usuario: { id: usuarioId, email, nombre, telefono, avatar_url: null } });
        } catch (e) {
            next(e);
        }
    });

    router.post('/auth/login', async (req, res, next) => {
        try {
            const email = limpiar(req.body?.email, 191).toLowerCase();
            const password = req.body?.password;
            if (!email || typeof password !== 'string' || password.length === 0) {
                return res.status(400).json({ error: 'Falta email o contrasena' });
            }

            const clave = claveIntento(req, email);
            if (estaBloqueado(clave)) {
                return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
            }

            const [filas] = await sql.query(
                'SELECT `id`, `email`, `nombre`, `telefono`, `password_hash`, `avatar_url`, `activo`, `google_id` FROM `usuarios` WHERE LOWER(`email`) = ? LIMIT 1',
                [email]
            );
            const usuario = filas[0];

            // Sin password_hash = cuenta que solo entra con Google.
            const passwordOk = usuario
                ? verificarPassword(password, usuario.password_hash)
                : verificarContraSenaluelo(password);

            if (!passwordOk) {
                registrarFallo(clave);
                return res.status(401).json({ error: ERROR_CREDENCIALES });
            }
            if (!usuario.activo) return res.status(403).json({ error: 'Cuenta desactivada' });

            const token = await crearSesion(sql, req, { tipo: 'cliente', usuarioId: usuario.id });
            limpiarIntentos(clave);
            ponerCookie(res, 'cliente', token);

            res.json({
                usuario: {
                    id: usuario.id, email: usuario.email, nombre: usuario.nombre,
                    telefono: usuario.telefono, avatar_url: usuario.avatar_url
                }
            });
        } catch (e) {
            next(e);
        }
    });

    router.post('/auth/google', async (req, res, next) => {
        try {
            const perfil = await verificarGoogle(req.body?.id_token);
            const clave = claveIntento(req, perfil.email);
            if (estaBloqueado(clave)) {
                return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
            }

            const [filas] = await sql.query(
                'SELECT `id`, `nombre`, `telefono`, `avatar_url`, `activo`, `google_id` FROM `usuarios` WHERE LOWER(`email`) = ? LIMIT 1',
                [perfil.email]
            );

            let usuarioId;
            if (filas.length > 0) {
                // El email ya esta verificado por Google, asi que se puede
                // vincular la cuenta existente sin pedir la contrasena.
                usuarioId = filas[0].id;
                if (!filas[0].google_id) {
                    await sql.query('UPDATE `usuarios` SET `google_id` = ?, `avatar_url` = COALESCE(?, `avatar_url`) WHERE `id` = ?',
                        [perfil.googleId, perfil.avatar, usuarioId]);
                }
            } else {
                const [resultado] = await sql.query(
                    'INSERT INTO `usuarios` (`email`, `nombre`, `google_id`, `avatar_url`) VALUES (?, ?, ?, ?)',
                    [perfil.email, perfil.nombre, perfil.googleId, perfil.avatar]
                );
                usuarioId = resultado.insertId;
            }

            const [vivos] = await sql.query('SELECT `activo` FROM `usuarios` WHERE `id` = ?', [usuarioId]);
            if (!vivos[0].activo) return res.status(403).json({ error: 'Cuenta desactivada' });

            const token = await crearSesion(sql, req, { tipo: 'cliente', usuarioId });
            limpiarIntentos(clave);
            ponerCookie(res, 'cliente', token);

            const [final] = await sql.query(
                'SELECT `id`, `email`, `nombre`, `telefono`, `avatar_url` FROM `usuarios` WHERE `id` = ?',
                [usuarioId]
            );
            res.json({ usuario: final[0] });
        } catch (e) {
            // Solo los errores de Google se responden con su mensaje; cualquier
            // otro (MySQL, red) lo maneja el error handler de server.js.
            if (e instanceof ErrorGoogle) return res.status(401).json({ error: e.message });
            next(e);
        }
    });

    router.post('/auth/logout', async (req, res, next) => {
        try {
            await borrarSesion(sql, req, 'cliente');
            borrarCookie(res, 'cliente');
            res.json({ success: true });
        } catch (e) {
            next(e);
        }
    });

    // --------------------------------------------------------------
    // 3) DIRECCIONES (solo clientes)
    // --------------------------------------------------------------
    router.get('/direcciones', soloCliente, async (req, res, next) => {
        try {
            const [filas] = await sql.query(
                'SELECT `id`, `apodo`, `direccion`, `ciudad`, `provincia`, `codigo_postal`, `es_default` FROM `direcciones` WHERE `usuario_id` = ? ORDER BY `es_default` DESC, `id` DESC',
                [req.auth.usuario.id]
            );
            res.json(filas);
        } catch (e) {
            next(e);
        }
    });

    router.post('/direcciones', soloCliente, async (req, res, next) => {
        const conexion = await sql.getConnection();
        try {
            const usuarioId = req.auth.usuario.id;
            const apodo = limpiar(req.body?.apodo, 60);
            const linea = limpiar(req.body?.direccion, 255);
            if (!apodo || !linea) return res.status(400).json({ error: 'Falta apodo o direccion' });

            await conexion.beginTransaction();

            const [primeras] = await conexion.execute('SELECT COUNT(*) AS `total` FROM `direcciones` WHERE `usuario_id` = ?', [usuarioId]);
            const esLaPrimera = primeras[0].total === 0;
            const esDefault = req.body?.es_default ? 1 : 0;

            // La primera direccion del usuario siempre queda como default.
            if (esDefault || esLaPrimera) {
                await conexion.execute('UPDATE `direcciones` SET `es_default` = 0 WHERE `usuario_id` = ?', [usuarioId]);
            }

            const [resultado] = await conexion.execute(
                `INSERT INTO \`direcciones\`
                    (\`usuario_id\`, \`apodo\`, \`direccion\`, \`ciudad\`, \`provincia\`, \`codigo_postal\`, \`es_default\`)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    usuarioId, apodo, linea,
                    limpiar(req.body?.ciudad, 120) || null,
                    limpiar(req.body?.provincia, 120) || null,
                    limpiar(req.body?.codigo_postal, 20) || null,
                    esDefault || esLaPrimera ? 1 : 0
                ]
            );

            const [filas] = await conexion.execute('SELECT * FROM `direcciones` WHERE `id` = ?', [resultado.insertId]);
            await conexion.commit();
            res.status(201).json(filas[0]);
        } catch (e) {
            await conexion.rollback().catch(() => {});
            next(e);
        } finally {
            conexion.release();
        }
    });

    router.put('/direcciones/:id', soloCliente, async (req, res, next) => {
        // Transaccion: o se actualiza la direccion y se reasigna la default, o
        // no cambia nada. Con dos UPDATE sueltos, un fallo entre ambos dejaba
        // al usuario sin ninguna direccion marcada como default.
        const conexion = await sql.getConnection();
        try {
            const usuarioId = req.auth.usuario.id;
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) return res.status(400).json({ error: 'id invalido' });

            // Solo se tocan las columnas que VIENEN en el body. La diferencia
            // importa: un campo que no viene se deja como estaba, y uno que viene
            // vacio se guarda como NULL (asi se puede borrar la ciudad desde la
            // UI, que manda todos los campos siempre). Con COALESCE no se podia
            // borrar nada y ademas un PUT de solo {ciudad} daba 400.
            const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
            const CAMPOS = [
                { col: 'apodo', largo: 60, obligatorio: true },
                { col: 'direccion', largo: 255, obligatorio: true },
                { col: 'ciudad', largo: 120, obligatorio: false },
                { col: 'provincia', largo: 120, obligatorio: false },
                { col: 'codigo_postal', largo: 20, obligatorio: false },
            ];
            const sets = [];
            const valores = [];
            for (const campo of CAMPOS) {
                if (!Object.prototype.hasOwnProperty.call(cuerpo, campo.col)) continue;
                const limpio = limpiar(cuerpo[campo.col], campo.largo);
                if (campo.obligatorio && !limpio) {
                    return res.status(400).json({ error: 'Falta apodo o direccion' });
                }
                sets.push(`\`${campo.col}\` = ?`);
                valores.push(limpio || null);
            }

            const mandaDefault = Object.prototype.hasOwnProperty.call(cuerpo, 'es_default');
            const esDefault = mandaDefault ? (cuerpo.es_default ? 1 : 0) : null;
            if (mandaDefault) {
                sets.push('`es_default` = ?');
                valores.push(esDefault);
            }

            if (sets.length === 0) {
                return res.status(400).json({ error: 'No mandaste ningun campo para actualizar' });
            }

            await conexion.beginTransaction();

            const [propias] = await conexion.execute(
                'SELECT `id` FROM `direcciones` WHERE `id` = ? AND `usuario_id` = ? FOR UPDATE',
                [id, usuarioId]
            );
            if (propias.length === 0) {
                await conexion.rollback();
                return res.status(404).json({ error: 'No existe esa direccion' });
            }

            if (esDefault === 1) {
                await conexion.execute('UPDATE `direcciones` SET `es_default` = 0 WHERE `usuario_id` = ?', [usuarioId]);
            }

            await conexion.execute(
                `UPDATE \`direcciones\` SET ${sets.join(', ')} WHERE \`id\` = ? AND \`usuario_id\` = ?`,
                [...valores, id, usuarioId]
            );

            // INVARIANTE: si el cliente tiene direcciones, siempre tiene una
            // principal. Si mandan es_default=false y era la unica marcada, no
            // se la_quitan: se avisa y sigue siendo la principal.
            if (esDefault === 0) {
                const [otra] = await conexion.execute(
                    'SELECT `id` FROM `direcciones` WHERE `usuario_id` = ? AND `es_default` = 1 LIMIT 1',
                    [usuarioId]
                );
                if (otra.length === 0) {
                    await conexion.execute('UPDATE `direcciones` SET `es_default` = 1 WHERE `id` = ?', [id]);
                }
            }

            const [filas] = await conexion.execute('SELECT * FROM `direcciones` WHERE `id` = ?', [id]);
            await conexion.commit();
            res.json(filas[0]);
        } catch (e) {
            await conexion.rollback().catch(() => {});
            next(e);
        } finally {
            conexion.release();
        }
    });

    router.delete('/direcciones/:id', soloCliente, async (req, res, next) => {
        // Transaccion por la misma razon que el PUT: si se borra la principal hay
        // que promote otra dentro de la misma transaccion.
        const conexion = await sql.getConnection();
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) return res.status(400).json({ error: 'id invalido' });
            const usuarioId = req.auth.usuario.id;

            await conexion.beginTransaction();

            const [propias] = await conexion.execute(
                'SELECT `id`, `es_default` FROM `direcciones` WHERE `id` = ? AND `usuario_id` = ? FOR UPDATE',
                [id, usuarioId]
            );
            if (propias.length === 0) {
                await conexion.rollback();
                return res.status(404).json({ error: 'No existe esa direccion' });
            }

            const [resultado] = await conexion.execute(
                'DELETE FROM `direcciones` WHERE `id` = ? AND `usuario_id` = ?',
                [id, usuarioId]
            );

            // Si se borro la principal, la mas reciente pasa a serlo: el usuario
            // nunca queda sin direccion principal (mismo invariante del PUT).
            if (Number(propias[0].es_default) === 1) {
                await conexion.execute(
                    'UPDATE `direcciones` SET `es_default` = 1 WHERE `usuario_id` = ? ORDER BY `id` DESC LIMIT 1',
                    [usuarioId]
                );
            }

            await conexion.commit();
            res.json({ success: true });
        } catch (e) {
            await conexion.rollback().catch(() => {});
            next(e);
        } finally {
            conexion.release();
        }
    });

    // --------------------------------------------------------------
    // 4) FAVORITOS (solo clientes)
    // --------------------------------------------------------------
    router.get('/favoritos', soloCliente, async (req, res, next) => {
        try {
            const [filas] = await sql.query(
                `SELECT f.\`id\`, f.\`vinilo_id\`, f.\`creado_en\`,
                        v.\`codigo\`, v.\`titulo\`, v.\`artista\`, v.\`precio_venta\`,
                        v.\`imagen_url\`, v.\`stock_actual\`
                   FROM \`favoritos\` f
                   LEFT JOIN \`inventario_vinilos\` v ON v.\`id\` = f.\`vinilo_id\`
                  WHERE f.\`usuario_id\` = ?
                  ORDER BY f.\`creado_en\` DESC`,
                [req.auth.usuario.id]
            );
            res.json(filas);
        } catch (e) {
            next(e);
        }
    });

    /** El catalogo pregunta "??esta en favoritos?" sin tener que traer la lista. */
    router.get('/favoritos/:viniloId', soloCliente, async (req, res, next) => {
        try {
            const [filas] = await sql.query(
                'SELECT `id` FROM `favoritos` WHERE `usuario_id` = ? AND `vinilo_id` = ? LIMIT 1',
                [req.auth.usuario.id, Number(req.params.viniloId)]
            );
            res.json({ favorito: filas.length > 0 });
        } catch (e) {
            next(e);
        }
    });

    router.post('/favoritos/:viniloId', soloCliente, async (req, res, next) => {
        try {
            const viniloId = Number(req.params.viniloId);
            if (!Number.isInteger(viniloId)) return res.status(400).json({ error: 'viniloId invalido' });
            await sql.query('INSERT IGNORE INTO `favoritos` (`usuario_id`, `vinilo_id`) VALUES (?, ?)', [req.auth.usuario.id, viniloId]);
            res.status(201).json({ success: true, favorito: true });
        } catch (e) {
            next(e);
        }
    });

    router.delete('/favoritos/:viniloId', soloCliente, async (req, res, next) => {
        try {
            const viniloId = Number(req.params.viniloId);
            await sql.query('DELETE FROM `favoritos` WHERE `usuario_id` = ? AND `vinilo_id` = ?', [req.auth.usuario.id, viniloId]);
            res.json({ success: true, favorito: false });
        } catch (e) {
            next(e);
        }
    });

    return router;
}

/**
 * Middlewares sueltos para proteger rutas que viven en server.js
 * (el backoffice no esta todo dentro del router de auth).
 *
 * @param {import('mysql2/promise').Pool} db
 */
export function middlewaresAuth(db) {
    const sql = db.promise();
    return {
        requiereAdmin: requiereAdmin(sql),
        requiereCliente: requiereCliente(sql),
        sesionClienteOpcional: sesionOpcional(sql, 'cliente')
    };
}

/**
 * Borra sesiones vencidas. Se llama cada hora desde server.js.
 * La tabla tiene indice por expira_en, asi que el DELETE es barato.
 */
export async function limpiarSesionesVencidas(db) {
    const sql = db.promise();
    const [resultado] = await sql.query('DELETE FROM `sesiones` WHERE `expira_en` < NOW()');
    return resultado.affectedRows;
}
