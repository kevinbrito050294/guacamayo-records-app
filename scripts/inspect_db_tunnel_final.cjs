const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

async function main() {
  const raw = execSync('railway variables --json --service mysql', {
    encoding: 'utf8',
    shell: 'cmd.exe',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const vars = JSON.parse(raw);

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: vars.MYSQLUSER || vars.MYSQL_USER || 'root',
    password: vars.MYSQLPASSWORD || vars.MYSQL_PASSWORD || '',
    database: vars.MYSQLDATABASE || vars.MYSQL_DATABASE || 'railway',
    connectTimeout: 15000,
  });
  const db = vars.MYSQLDATABASE || vars.MYSQL_DATABASE || 'railway';
  console.log('CONNECTED OK -> ' + db + ' (credenciales ocultas)');

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
    console.log('\n--- DESC ' + t.TABLE_NAME + ' ---');
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
