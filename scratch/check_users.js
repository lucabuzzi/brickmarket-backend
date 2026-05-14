require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('Columns:', res.rows.map(r => r.column_name));
    
    const sample = await pool.query("SELECT id, username, country, address_country FROM users LIMIT 1");
    console.log('Sample row:', sample.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
