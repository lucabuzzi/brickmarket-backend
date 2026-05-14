require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  const r = await query(
    "SELECT id, title, status, condition FROM listings WHERE status = 'active' ORDER BY created_at DESC"
  );
  console.log('Active listings:', r.rows.length);
  r.rows.forEach(l => console.log(' -', l.title, '| condition:', l.condition));
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
