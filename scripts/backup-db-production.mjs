import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { escape } from 'mysql2';

const url = process.env.MYSQL_URL;
const output = process.env.BACKUP_SQL_PATH;
if (!url || !output) throw new Error('Faltan MYSQL_URL o BACKUP_SQL_PATH.');

const connection = await mysql.createConnection(url);
const sql = [];
const stamp = new Date().toISOString();
sql.push('-- GuacamayoRecords production database backup');
sql.push(`-- Created: ${stamp}`);
sql.push('SET FOREIGN_KEY_CHECKS=0;');
sql.push('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');

const [tables] = await connection.query('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
const tableName = row => Object.values(row)[0];

for (const row of tables) {
  const name = tableName(row);
  const escapedName = `\`${String(name).replaceAll('`', '``')}\``;
  const [[definition]] = await connection.query(`SHOW CREATE TABLE ${escapedName}`);
  const createSql = definition['Create Table'];
  sql.push(`\n-- Structure: ${name}`);
  sql.push(`DROP TABLE IF EXISTS ${escapedName};`);
  sql.push(`${createSql};`);

  const [rows] = await connection.query(`SELECT * FROM ${escapedName}`);
  if (rows.length === 0) continue;
  const columns = Object.keys(rows[0]).map(column => `\`${column.replaceAll('`', '``')}\``).join(', ');
  for (let offset = 0; offset < rows.length; offset += 100) {
    const chunk = rows.slice(offset, offset + 100);
    const values = chunk.map(item => `(${Object.values(item).map(value => value === null ? 'NULL' : escape(value)).join(', ')})`).join(',\n');
    sql.push(`INSERT INTO ${escapedName} (${columns}) VALUES\n${values};`);
  }
}

const [views] = await connection.query('SHOW FULL TABLES WHERE Table_type = \'VIEW\'');
for (const row of views) {
  const name = tableName(row);
  const escapedName = `\`${String(name).replaceAll('`', '``')}\``;
  const [[definition]] = await connection.query(`SHOW CREATE VIEW ${escapedName}`);
  sql.push(`\n-- View: ${name}`);
  sql.push(`DROP VIEW IF EXISTS ${escapedName};`);
  sql.push(`${definition['Create View']};`);
}

const [triggers] = await connection.query('SHOW TRIGGERS');
for (const trigger of triggers) {
  const name = `\`${String(trigger.Trigger).replaceAll('`', '``')}\``;
  const [[definition]] = await connection.query(`SHOW CREATE TRIGGER ${name}`);
  sql.push(`\n-- Trigger: ${trigger.Trigger}`);
  sql.push(`DROP TRIGGER IF EXISTS ${name};`);
  sql.push(`${definition['SQL Original Statement']};`);
}

sql.push('\nSET FOREIGN_KEY_CHECKS=1;');
await fs.writeFile(output, `${sql.join('\n')}\n`, 'utf8');
await connection.end();
console.log(JSON.stringify({ output, tables: tables.length, views: views.length, triggers: triggers.length }));
