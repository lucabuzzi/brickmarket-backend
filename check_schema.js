const { query } = require('./src/db');

async function checkSchema() {
  try {
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'master_sets'
    `);
    console.log('Columns in master_sets:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
  } catch (err) {
    console.error('Error checking schema:', err.message);
  } finally {
    process.exit();
  }
}

checkSchema();
