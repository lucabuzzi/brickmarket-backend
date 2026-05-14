const { query } = require('./src/db/index.js');

async function migrate() {
  try {
    console.log("Adding package_size to listings...");
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS package_size VARCHAR(50) DEFAULT 'medium'`);
    console.log("Migration successful");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
