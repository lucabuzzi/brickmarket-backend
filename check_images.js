const { query } = require('./src/db');
query("SELECT id, title, images FROM listings ORDER BY created_at DESC LIMIT 5")
  .then(r => { 
    console.log(JSON.stringify(r.rows, null, 2)); 
    process.exit(0); 
  })
  .catch(e => { 
    console.error(e.message); 
    process.exit(1); 
  });
