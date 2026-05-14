const { query } = require('./src/db');
query("SELECT id, email, username, role, is_active FROM users WHERE email = 'luka888@msn.com'")
  .then(r => {
    console.log(JSON.stringify(r.rows[0], null, 2));
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
