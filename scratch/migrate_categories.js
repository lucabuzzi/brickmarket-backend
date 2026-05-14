const { query } = require('../src/db');

async function migrateCategories() {
  console.log('--- MIGRATION: MANDATORY CATEGORIES ---');
  try {
    // 1. Aggiungi colonna category
    console.log('Adding "category" column to listings...');
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS category VARCHAR(20)`);

    // 2. Popola i dati esistenti
    console.log('Populating existing listings with "sets" as default...');
    await query(`UPDATE listings SET category = 'sets'`);

    // 3. Aggiungi il vincolo NOT NULL e il CHECK
    console.log('Adding NOT NULL and CHECK constraints...');
    await query(`ALTER TABLE listings ALTER COLUMN category SET NOT NULL`);
    
    // Rimuovi check se esiste già per evitare duplicati (facoltativo se si sa che non c'è)
    await query(`ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_category_check`);
    await query(`ALTER TABLE listings ADD CONSTRAINT listings_category_check CHECK (category IN ('sets', 'mocs', 'minifigures'))`);

    console.log('Migration COMPLETED successfully.');
  } catch (err) {
    console.error('Migration FAILED:', err.message);
  } finally {
    process.exit();
  }
}

migrateCategories();
