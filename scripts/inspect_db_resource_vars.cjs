const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');

function railwayVarsJson() {
  const cmd = process.platform === 'win32' ? 'railway variables --json --service mysql' : 'railway variables --json --service mysql';
  const raw = execSync(cmd, { encoding: 'utf8', shell: 'cmd.exe', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(raw);
}

async function main() {
  const v = railwayVarsJson();
  const db = v.MYSQLDATABASE || v.MYSQL_DATABASE || v.MYSQLDATABASE_URL_DB || 'railway';
  const user = v.MYSQLUSER || v.MYSQL_USER || 'root';
  const password = v.MYSQLPASSWORD || v.MYSQL_PASSWORD || '';

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user,
    password,
    database: db,
    connectTimeout: 15000,
  });
  console.log('CONNECTED OK -> BD=' + db + ' (credenciales nunca mostradas)');

  const [tables] = await conn.query(
    `SELECT table_name, table_rows, engine, create_time FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name`,
    [db]
  );
  console.log('\n=== TABLAS (' + tables.length + ') ===');
  for (const t of tables) {
    console.log('- ' + t.TABLE_NAME + '  [rows=' + t.TABLE_ROWS + ' engine=' + t.ENGINE + ' created=' + (t.CREATE_TIME || '') + ']');
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
