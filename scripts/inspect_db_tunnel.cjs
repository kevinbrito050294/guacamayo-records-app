const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:set\s+"|export\s+|set\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*"?\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\#/g, '#').replace(/\\n/g, '\n').replace(/&/g, '&');
    if (v.includes(';SET ')) v = v.split(';SET ')[0];
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  const env = loadEnv(envFilePhotographed);

  const url = env.MYSQL_URL || env.MYSQLDATABASE_URL || env.DATABASE_URL || env.MYSQLDATABASEURL;
  if (url) {
    console.log('MODO URL -> (oculto)');
    await viaUrl(url);
    return;
  }

  const host = env.MYSQLHOST || env.MYSQL_HOST || '127.0.0.1';
  const port = Number(env.MYSQLPORT || env.MYSQL_PORT || 3306);
  if (!env.MYSQLPASSWORD && !env.MYSQL_PASSWORD) throw new Error('MYSQLPASSWORD no encontrado en .env');
  const db = env.MYSQLDATABASE || env.MYSQL_DATABASE || env.MYSQLDATABASEURLDB || 'railway';

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: env.MYSQLUSER || env.MYSQL_USER || 'root',
    password: env.MYSQLPASSWORD || env.MYSQL_PASSWORD || '',
    database: db,
    connectTimeout: 15000,
  });
  console.log('CONNECTED OK -> ' + db + ' (credenciales ocultas nunca se muestran)');

  const [tables] = await conn.query(
    `SELECT table_name, table_rows, engine, create_time FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [db]
  );
  console.log('\n=== TABLAS (' + tables.length + ') ===');
  for (const t of tables) {
    console.log('- ' + t.TABLE_NAME + '  [rows=' + t.TABLE_ROWS + ' engine=' + t.ENGINE + ' created=' + t.CREATE_TIME + ']');
  }

  for (const t of tables) {
    const [cols] = await conn.query(
      `SELECT column_name, column_type, is_nullable, column_default, column_key, extra FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      [db, t.TABLE_NAME]
    );
    console.log('\n--- DESCRIBE ' + t.TABLE_NAME + ' ---');
    for (const col of cols) {
      console.log('  ' + col.COLUMN_NAME + ': ' + col.COLUMN_TYPE + ' null=' + col.IS_NULLABLE + ' key=' + col.COLUMN_KEY + ' def=' + col.COLUMN_DEFAULT + ' extra=' + col.EXTRA);
    }
  }

  await conn.end();
  console.log('\n=== DONE ===');
}

async function viaUrl(url) {
  const m = url.match(/^mysql:\/\/([^:]*):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]*)/);
  if (!m) throw new Error('URL mysql no parseable');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: m[1],
    password: m[2],
    database: m[5],
    connectTimeout: 15000,
  });
  const db = m[5];
  console.log('CONNECTED OK -> ' + db + ' (credenciales ocultas nunca se muestran)');
  const [tables] = await conn.query(
    `SELECT table_name, table_rows, engine, create_time FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [db]
  );
  console.log('\n=== TABLAS (' + tables.length + ') ===');
  for (const t of tables) {
    console.log('- ' + t.TABLE_NAME + '  [rows=' + t.TABLE_ROWS + ' engine=' + t.ENGINE + ' created=' + t.CREATE_TIME + ']');
  }
  for (const t of tables) {
    const [cols] = await conn.query(
      `SELECT column_name, column_type, is_nullable, column_default, column_key, extra FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      [db, t.TABLE_NAME]
    );
    console.log('\n--- DESCRIBE ' + t.TABLE_NAME + ' ---');
    for (const col of cols) {
      console.log('  ' + col.COLUMN_NAME + ': ' + col.COLUMN_TYPE + ' null=' + col.IS_NULLABLE + ' key=' + col.COLUMN_KEY + ' def=' + col.COLUMN_DEFAULT + ' extra=' + col.EXTRA);
    }
  }
  await conn.end();
  console.log('\n=== DONE ===');
}

main().catch((e) => {
  console.error('ERROR: ' + e.message);
  process.exit(1);
});
