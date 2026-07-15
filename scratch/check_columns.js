require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'listings'
    `);
    console.log('Columns in listings:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
  } catch (err) {
    console.error('Error checking schema:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
