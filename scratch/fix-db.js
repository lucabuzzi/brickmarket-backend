const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  const sqlFilePath = path.join(__dirname, 'src', 'db', 'migrate_listings_type_constraint.sql');

  try {
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    await client.connect();
    console.log('Connected to database.');

    console.log('Executing SQL commands...');
    await client.query(sql);

    console.log('SQL commands executed successfully.');
  } catch (err) {
    console.error('Error executing SQL file:', err);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

run();
