require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function update() {
  try {
    await pool.query(`
      UPDATE users 
      SET bio = 'Collezionista esperto di set Star Wars e Technic. Amo i MOC e cerco sempre pezzi rari per la mia collezione.', 
          address_country = 'it' 
      WHERE username = 'Ludex'
    `);
    console.log('Ludex bio updated');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

update();
