const { query } = require('./src/db/index.js');

async function migrate() {
  try {
    console.log("Adding shipping_options to listings...");
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS shipping_options JSONB DEFAULT '[]'::jsonb`);
    
    console.log("Adding selected_carrier to orders...");
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_carrier VARCHAR(100)`);
    
    // shipping_cost already exists in listings according to prior code, but wait, orders table needs shipping_cost too? 
    // Wait, the prompt says: "Update the orders table to include selected_carrier and shipping_cost."
    // I'll add shipping_cost to orders (numeric).
    console.log("Adding shipping_cost to orders...");
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0`);
    
    console.log("Migration successful");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
