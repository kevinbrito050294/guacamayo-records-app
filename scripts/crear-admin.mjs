// ==========================================
// scripts/crear-admin.mjs
// Crea o actualiza un usuario del backoffice (tabla admin_usuarios).
//
// El password NO se escribe en ningun archivo: se pasa por variable de
// entorno o por argumento, y en la BD solo queda el hash scrypt.
//
// USO
//   $env:ADMIN_PASSWORD='mi-clave'; node scripts/crear-admin.mjs --email admin@guacamayorecords.com --nombre "Guacamayo"
//   node scripts/crear-admin.mjs --email admin@guacamayorecords.com --password 'mi-clave' --nombre "Guacamayo"
//   ... --rol admin|editor --activo 0        (opcionales)
//
// Requiere que la tabla exista: db/migrations/2026-09-26_auth.sql
// ==========================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { hashPassword } from '../auth.js';

const __dirname = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// --- MYSQL_URL: de process.env, o del .env (tolera el formato viejo: una
//     linea con la URL sola, sin "MYSQL_URL=" delante) ---
function leerMysqlUrl() {
    if (process.env.MYSQL_URL) return process.env.MYSQL_URL;

    const rutaEnv = path.join(__dirname, '.env');
    if (fs.existsSync(rutaEnv)) {
        for (const linea of fs.readFileSync(rutaEnv, 'utf8').split(/\r?\n/)) {
            const conClave = linea.match(/^\s*MYSQL_URL\s*=\s*(.+)\s*$/);
            if (conClave) return conClave[1].trim().replace(/^["']|["']$/g, '');
            const suelta = linea.trim();
            if (suelta.startsWith('mysql://')) return suelta;
        }
    }
    return null;
}

function argumentos(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const clave = argv[i].slice(2);
        const valor = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
        args[clave] = valor;
    }
    return args;
}

const args = argumentos(process.argv.slice(2));
const email = (args.email || '').trim().toLowerCase();
const nombre = (args.nombre || 'Guacamayo').trim();
const rol = (args.rol || 'admin').trim();
const password = args.password || process.env.ADMIN_PASSWORD || '';
const activo = args.activo === '0' || args.activo === 'false' ? 0 : 1;

if (!email || !email.includes('@')) {
    console.error('Falta --email (ej: --email admin@guacamayorecords.com)');
    process.exit(1);
}
if (password.length < 8) {
    console.error('Falta la contrasena: pasala con --password "..." o con $env:ADMIN_PASSWORD="..." (minimo 8 caracteres).');
    process.exit(1);
}

const MYSQL_URL = leerMysqlUrl();
if (!MYSQL_URL) {
    console.error('No se encontro MYSQL_URL (ni en el entorno ni en .env)');
    process.exit(1);
}

const db = await mysql.createConnection(MYSQL_URL);
const hash = hashPassword(password);

try {
    const [existentes] = await db.execute('SELECT `id` FROM `admin_usuarios` WHERE LOWER(`email`) = ? LIMIT 1', [email]);

    if (existentes.length > 0) {
        await db.execute(
            'UPDATE `admin_usuarios` SET `nombre` = ?, `password_hash` = ?, `rol` = ?, `activo` = ? WHERE `id` = ?',
            [nombre, hash, rol, activo, existentes[0].id]
        );
        console.log(`Actualizado: ${email} (rol ${rol}, activo ${activo})`);
    } else {
        await db.execute(
            'INSERT INTO `admin_usuarios` (`email`, `nombre`, `password_hash`, `rol`, `activo`) VALUES (?, ?, ?, ?, ?)',
            [email, nombre, hash, rol, activo]
        );
        console.log(`Creado: ${email} (rol ${rol}, activo ${activo})`);
    }
} catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
        console.error('Falta la tabla admin_usuarios. Primero corré db/migrations/2026-09-26_auth.sql');
    } else {
        console.error('Error:', e.message);
    }
    process.exitCode = 1;
} finally {
    await db.end();
}
