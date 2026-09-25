const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const envFile = path.join(path.resolve(__dirname, '..'), '.env');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

function parseMysqlUrl(url) {
  const m = url.match(/^mysql:\/\/([^:]*):([^@]*)@([^:/]+)(?::(\d+))?\/([^?]*)/);
  if (!m) throw new Error('URL no parseable');
  return { user: m[1], password: m[2], host: m[3], port: m[4] ? Number(m[4]) : 3306, database: m[5] };
}

async function main() {
  const env = loadEnv(envFile);
  const url = env.MYSQL_URL || env.DATABASE_URL || env.MYSQLDATABASE_URL;
  if (!url) throw new Error('No se encontro MYSQL_URL en .env');
  const c = parseMysqlUrl(url);

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: c.user,
    password: c.password,
    database: c.database,
  });
  console.log('CONNECTED OK -> ' + c.database + ' (credenciales ocultas)');

  const [tables] = await conn.query(
    `SELECT table_name, table_rows, engine, create_time FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [c.database]
  );
  console.log('\n=== TABLAS (' + tables.length + ') ===');
  for (const t of tables) {
    console.log(`- ${t.TABLE_NAME}  [rows=${t.TABLE_ROWS} engine=${t.ENGINE}]`);
  }

  for (const t of tables) {
    const [cols] = await conn.query(
      `SELECT column_name, column_type, is_nullable, column_default, column_key, extra FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      [c.database, t.TABLE_NAME]
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
