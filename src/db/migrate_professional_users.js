const { Client } = require('pg');
require('dotenv').config({ path: '../../.env' }); // or require('dotenv').config() depending on execution path
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database. Running migration...');

    const sql = `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(200),
      ADD COLUMN IF NOT EXISTS address_street VARCHAR(200),
      ADD COLUMN IF NOT EXISTS address_house_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS address_zip_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS address_country VARCHAR(100),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS id_scan_url TEXT,
      ADD COLUMN IF NOT EXISTS business_license_url TEXT;
    `;

    await client.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
