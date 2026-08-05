const { Client } = require('pg');
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
    console.log('Connected to database. Running listing product_type migration...');

    await client.query(`
      ALTER TABLE listings
        ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) NOT NULL DEFAULT 'lego',
        ADD COLUMN IF NOT EXISTS game VARCHAR(20);
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_product_type_check') THEN
          ALTER TABLE listings ADD CONSTRAINT listings_product_type_check
            CHECK (product_type IN ('lego','funko','tcg'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listings_game_check') THEN
          ALTER TABLE listings ADD CONSTRAINT listings_game_check
            CHECK (game IS NULL OR game IN ('pokemon','magic','lorcana','yugioh','onepiece','dragonball'));
        END IF;
      END $$;
    `);

    console.log('Listing product_type migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
