const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Obbligatorio per Supabase
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};