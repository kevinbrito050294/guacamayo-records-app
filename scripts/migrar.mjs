// ==========================================
// scripts/migrar.mjs
// Corre los archivos de db/migrations/*.sql en orden y no repite los que ya
// quedaron aplicados (se anotan solos en la tabla `migraciones`).
//
// USO
//   node scripts/migrar.mjs              -- aplica lo que falta
//   node scripts/migrar.mjs --dry-run    -- solo muestra el plan (no conecta)
//   node scripts/migrar.mjs --estado     -- muestra applied/pending y sale
//   node scripts/migrar.mjs --archivo 2026-09-27_cupones.sql   -- solo ese
//
// MYSQL_URL
//   1) process.env.MYSQL_URL
//   2) .env (tolera el formato viejo: la URL sola, sin "MYSQL_URL=")
//   3) --url "mysql://user:pass@host:port/base"
//
// POR QUE EXISTE
//   Los .sql son idempotentes (IF NOT EXISTS + guards de information_schema), asi
//   que correrlos dos veces no rompe nada. Este script ademas deja registro de
//   cual se aplico, para no ensuciar la base con DDL repetido en cada deploy.
//
// CONEXION DESDE LA PC
//   El host de Railway (mysql.railway.internal) no resuelve fuera de la red de
//   Railway. Para correr esto desde la PC hay que abrir un tunel:
//     railway connect MySQL --ssh --tunnel-only -P 33306
//   y en otra terminal:
//     $env:MYSQL_URL='mysql://root:CLAVE@127.0.0.1:33306/railway'; npm run migrar
// ==========================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CARPETA = path.join(__dirname, 'db', 'migrations');

// --- Argumentos (mismo parser simple que crear-admin.mjs) ---
const args = {};
for (let i = 2; i < process.argv.length; i++) {
    if (!process.argv[i].startsWith('--')) continue;
    const clave = process.argv[i].slice(2);
    const valor = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true';
    args[clave] = valor;
}
const soloArchivo = typeof args.archivo === 'string' ? args.archivo : null;
const hashArchivo = (nombre) =>
    crypto.createHash('sha256').update(fs.readFileSync(path.join(CARPETA, nombre))).digest('hex').slice(0, 16);

// --- MYSQL_URL ---
function leerMysqlUrl() {
    if (args.url) return String(args.url);
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

// --- Migraciones disponibles (orden = orden de nombre, que ya es la fecha) ---
const archivos = fs.existsSync(CARPETA)
    ? fs.readdirSync(CARPETA).filter((f) => f.endsWith('.sql')).sort()
    : [];

if (archivos.length === 0) {
    console.error(`No hay archivos .sql en ${CARPETA}`);
    process.exit(1);
}

// --- Plan (sin base) ---
if (args['dry-run'] || soloArchivo === null) {
    console.log(`Migraciones en ${CARPETA}:`);
    for (const archivo of archivos) {
        const marca = soloArchivo === archivo ? '  <- pedida' : '';
        console.log(`  ${archivo}  (${hashArchivo(archivo)})${marca}`);
    }
    console.log('');
}
if (args['dry-run']) {
    console.log('Dry run: no se conecto a la base.');
    process.exit(0);
}

const MYSQL_URL = leerMysqlUrl();
if (!MYSQL_URL) {
    console.error('No se encontro MYSQL_URL (ni en --url, ni en el entorno, ni en .env)');
    process.exit(1);
}

// La URL puede traer query params (?ssl=true&...): se pasan como opciones.
function configDesdeUrl(url) {
    const u = new URL(url);
    const opciones = {
        host: decodeURIComponent(u.hostname),
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username || 'root'),
        password: decodeURIComponent(u.password),
        database: decodeURIComponent((u.pathname || '/').replace(/^\//, '')) || undefined,
        // Los .sql traen many statements por archivo (CREATE + ALTER + PREPARE...).
        multipleStatements: true,
        charset: 'utf8mb4',
    };
    if (u.searchParams.get('ssl')) opciones.ssl = { rejectUnauthorized: false };
    return opciones;
}

let db;
try {
    db = await mysql.createConnection(configDesdeUrl(MYSQL_URL));
} catch (e) {
    console.error(`No se pudo conectar: ${e.code || ''} ${e.message}`.trim());
    console.error('Si estas en la PC, el host de Railway no resuelve: usá `railway connect MySQL --ssh --tunnel-only -P 33306` y apuntá MYSQL_URL a 127.0.0.1.');
    process.exit(1);
}

try {
    // Registro de lo aplicado. El nombre del archivo es la clave: por eso los
    // archivos no se renombran una vez aplicados.
    await db.query(
        `CREATE TABLE IF NOT EXISTS \`migraciones\` (
            \`nombre\`      VARCHAR(190) NOT NULL,
            \`hash\`        CHAR(16)     NULL,
            \`aplicada_en\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`nombre\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          COMMENT='Historial de migraciones aplicadas (scripts/migrar.mjs)'`
    );

    const [aplicadas] = await db.query('SELECT `nombre`, `hash`, `aplicada_en` FROM `migraciones`');
    const porNombre = new Map(aplicadas.map((f) => [f.nombre, f]));

    // Conexion actual: para que el log diga contra que base se esta escribiendo.
    const [[info]] = await db.query('SELECT DATABASE() AS `base`, VERSION() AS `version`');
    console.log(`Base: ${info.base} (MySQL ${info.version})`);
    console.log('');

    const candidatas = soloArchivo ? archivos.filter((f) => f === soloArchivo) : archivos;
    if (candidatas.length === 0) {
        console.error(`No existe la migracion "${soloArchivo}" en ${CARPETA}`);
        process.exit(1);
    }

    let aplicadasAhora = 0;
    for (const archivo of candidatas) {
        const previa = porNombre.get(archivo);
        const hash = hashArchivo(archivo);

        if (previa) {
            const nota = previa.hash && previa.hash !== hash ? '  (el archivo cambio despues de aplicarse)' : '';
            console.log(`= ${archivo}  ya aplicada el ${previa.aplicada_en}${nota}`);
            continue;
        }

        console.log(`> ${archivo}  aplicando...`);
        const sql = fs.readFileSync(path.join(CARPETA, archivo), 'utf8');
        const inicio = Date.now();
        try {
            await db.query(sql);
        } catch (e) {
            console.error(`X ${archivo}  fallo: ${e.code || ''} ${e.message}`.trim());
            console.error('  Se detiene aca: las siguientes migraciones pueden depender de esta.');
            process.exit(1);
        }
        await db.query('INSERT INTO `migraciones` (`nombre`, `hash`) VALUES (?, ?)', [archivo, hash]);
        console.log(`+ ${archivo}  ok (${Date.now() - inicio} ms)`);
        aplicadasAhora++;
    }

    console.log('');
    console.log(aplicadasAhora === 0
        ? 'Nada pendiente: la base ya estaba al dia.'
        : `Listo: ${aplicadasAhora} migracion(es) aplicada(s).`);
} finally {
    await db.end();
}
