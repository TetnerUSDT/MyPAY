const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute('DESCRIBE balances');
  console.log('Columns in balances table:');
  rows.forEach(row => console.log(`  ${row.Field} - ${row.Type}`));
  await conn.end();
}

check().catch(console.error);
