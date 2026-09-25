'use strict';
const { execSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const raw = execSync('railway variables --json mysql', { encoding: 'utf8', shell: 'cmd.exe' });
  const vars = JSON.parse(raw顯);

  const host = vars.MYSQLHOST || vars.MYSQL_HOST || '127.0.0.1';
  const port = Number(vars.MYSQLPORT || vars.MYSQL_PORT || 3306);
  const user = vars.MYSQLUSER || vars.MYSQL_USER || 'root';
  const password = vars.MYSQLPASSWORD || vars.MYSQL_PASSWORD || '';
  const dbName = vars.MYSQLDATABASE || vars.MYSQL_DATABASE || vars.MYSQLDATABASEURLDB || 'railway';

  console.log('Obtuve credenciales por el CLI en memoria (no se muestran). BD objetivo: ' + dbName);

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user,
    password,
    database: dbName,
    connectTimeout: 15000,
  });
  console.log('CONNECTED OK -> ' + dbName);

  const [tables] = await conn.query(
    `SELECT table_name, table_rows, engine, create_time FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [dbName]
  );
  console.log('\n=== TABLAS (' + tables.length + ') ===');
  for (const t of tables) {
    console.log('- ' + t.TABLE_NAME + '  [rows=' + t.TABLE_ROWS + ' engine=' + t.ENGINE + ' created=' + t.CREATE_TIME + ']');
  }

  for (const t of tables) {
    const [cols] = await conn.query(
      `SELECT column_name, column_type, is_nullable, column_default, column_key, extra FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position`,
      [dbName, t.TABLE_NAME]
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
