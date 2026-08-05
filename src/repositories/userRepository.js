const { query } = require('../db');

const PUBLIC_FIELDS = `id, email, username, full_name, role, city, avatar_url, seller_type, company_name,
       stripe_account_id, stripe_account_status,
       rating_avg, rating_count, sales_count, is_verified, is_active, email_verified,
       created_at, updated_at`;

function findByEmailOrUsername(email, username) {
  return query(
    'SELECT * FROM users WHERE email = $1 OR username = $2',
    [email.toLowerCase(), username]
  ).then((r) => r.rows[0] || null);
}

function findByEmailOrUsernameLogin(emailOrUsernameInput) {
  return query(
    'SELECT * FROM users WHERE email = $1 OR username = $2',
    [emailOrUsernameInput.toLowerCase(), emailOrUsernameInput]
  ).then((r) => r.rows[0] || null);
}

function findById(userId, client) {
  const db = client || { query };
  return db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [userId])
    .then((r) => r.rows[0] || null);
}

function findByEmail(email) {
  return query('SELECT id, is_active FROM users WHERE email = $1', [email.toLowerCase()])
    .then((r) => r.rows[0] || null);
}

async function createUser({
  email, passwordHash, username, fullName, role, city,
  fiscalCode, iban, sellerType, companyName, street, houseNumber,
  zipCode, country, phone, idScanUrl, businessLicenseUrl,
}) {
  const result = await query(`
    INSERT INTO users
      (email, password_hash, username, full_name, role, city, fiscal_code, iban, seller_type,
       company_name, address_street, address_house_number, address_zip_code, address_country, phone,
       id_scan_url, business_license_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id, email, username, role
  `, [
    email.toLowerCase(), passwordHash, username, fullName || null, role, city,
    fiscalCode, iban, sellerType, companyName, street, houseNumber, zipCode, country, phone,
    idScanUrl, businessLicenseUrl,
  ]);
  return result.rows[0];
}

async function updateProfile(userId, fields) {
  const setClauses = [];
  const values = [];
  let count = 1;

  for (const [column, val] of Object.entries(fields)) {
    setClauses.push(`${column} = $${count}`);
    values.push(val);
    count++;
  }

  if (setClauses.length === 0) return null;

  values.push(userId);
  const result = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${count}
     RETURNING id, email, username, full_name, role, city, avatar_url`,
    values
  );
  return result.rows[0] || null;
}

async function setResetToken(email, hashedToken, expires) {
  await query(
    'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE email = $3',
    [hashedToken, expires, email.toLowerCase()]
  );
}

function findByResetToken(hashedToken) {
  return query(
    'SELECT id, email FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
    [hashedToken]
  ).then((r) => r.rows[0] || null);
}

async function updatePassword(userId, passwordHash) {
  await query(
    'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
    [passwordHash, userId]
  );
}

// --- OAuth / account linking (all accept an optional transaction client) ---

function findIdentity(provider, providerUserId, client) {
  const db = client || { query };
  return db.query(
    'SELECT user_id FROM user_identities WHERE provider = $1 AND provider_user_id = $2',
    [provider, providerUserId]
  ).then((r) => r.rows[0] || null);
}

function findByEmailFull(email, client) {
  const db = client || { query };
  return db.query(
    'SELECT id, email, username, role, is_active, email_verified FROM users WHERE email = $1',
    [email.toLowerCase()]
  ).then((r) => r.rows[0] || null);
}

function usernameExists(username, client) {
  const db = client || { query };
  return db.query('SELECT 1 FROM users WHERE username = $1', [username])
    .then((r) => r.rows.length > 0);
}

async function createOAuthUser({ email, username, fullName, emailVerified }, client) {
  const db = client || { query };
  const result = await db.query(`
    INSERT INTO users (email, password_hash, username, full_name, role, email_verified)
    VALUES ($1, NULL, $2, $3, 'buyer', $4)
    RETURNING id, email, username, role
  `, [email.toLowerCase(), username, fullName || null, emailVerified]);
  return result.rows[0];
}

async function createIdentity(userId, provider, providerUserId, email, client) {
  const db = client || { query };
  await db.query(
    'INSERT INTO user_identities (user_id, provider, provider_user_id, email) VALUES ($1, $2, $3, $4)',
    [userId, provider, providerUserId, email ? email.toLowerCase() : null]
  );
}

module.exports = {
  findByEmailOrUsername,
  findByEmailOrUsernameLogin,
  findById,
  findByEmail,
  createUser,
  updateProfile,
  setResetToken,
  findByResetToken,
  updatePassword,
  findIdentity,
  findByEmailFull,
  usernameExists,
  createOAuthUser,
  createIdentity,
};
