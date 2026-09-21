const { query } = require('../db');

// address_* were missing here even though they're collected at registration
// (migrate_professional_users.js) — every caller of findById got `undefined`
// for the buyer/seller's country, street, etc. with no error, which is what
// made src/controllers/paymentsController.js's `buyer?.address_country || 'it'`
// silently always fall back to 'it'. Included now.
const PUBLIC_FIELDS = `id, email, username, full_name, role, city, avatar_url, seller_type, company_name,
       stripe_account_id, stripe_account_status,
       address_street, address_house_number, address_zip_code, address_country, phone,
       rating_avg, rating_count, sales_count, is_verified, is_active, email_verified, referral_code,
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
  email, passwordHash, username, fullName, role = 'user', city,
  fiscalCode, iban, sellerType, companyName, street, houseNumber,
  zipCode, country, phone, idScanUrl, businessLicenseUrl, referralCode,
}) {
  const result = await query(`
    INSERT INTO users
      (email, password_hash, username, full_name, role, city, fiscal_code, iban, seller_type,
       company_name, address_street, address_house_number, address_zip_code, address_country, phone,
       id_scan_url, business_license_url, referral_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING id, email, username, role
  `, [
    email.toLowerCase(), passwordHash, username, fullName || null, role, city,
    fiscalCode, iban, sellerType, companyName, street, houseNumber, zipCode, country, phone,
    idScanUrl, businessLicenseUrl, referralCode,
  ]);
  return result.rows[0];
}

function referralCodeExists(code, client) {
  const db = client || { query };
  return db.query('SELECT 1 FROM users WHERE referral_code = $1', [code])
    .then((r) => r.rows.length > 0);
}

function findUserByReferralCode(code) {
  return query('SELECT id FROM users WHERE referral_code = $1', [code])
    .then((r) => r.rows[0] || null);
}

function createReferral(referrerId, referredId, referralCode) {
  return query(
    'INSERT INTO public.referrals (referrer_id, referred_id, referral_code) VALUES ($1, $2, $3)',
    [referrerId, referredId, referralCode]
  );
}

// Singola UPDATE atomica, stesso principio di verifyEmailByToken: solo la prima
// chiamata per questo invitato può far scattare pending->completed, quindi il
// bonus al referrer non può mai essere accreditato due volte per lo stesso invitato.
function completeReferral(referredId) {
  return query(
    `UPDATE public.referrals
     SET status = 'completed', completed_at = now()
     WHERE referred_id = $1 AND status = 'pending'
     RETURNING referrer_id`,
    [referredId]
  ).then((r) => r.rows[0] || null);
}

function getReferralStats(userId) {
  return query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
     FROM public.referrals WHERE referrer_id = $1`,
    [userId]
  ).then((r) => r.rows[0] || { completed: 0, pending: 0 });
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
     RETURNING id, email, username, full_name, role, city, avatar_url,
       address_street, address_house_number, address_zip_code, address_country, phone`,
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

async function setEmailVerificationToken(userId, hashedToken, expires) {
  await query(
    'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
    [hashedToken, expires, userId]
  );
}

// Singola UPDATE atomica: solo la prima richiesta con un token ancora valido riesce a
// far scattare email_verified false->true (la condizione WHERE email_verified = false
// smette di essere vera per qualunque tentativo successivo), quindi due click paralleli
// sullo stesso link non possono mai accreditare il bonus di registrazione due volte.
function verifyEmailByToken(hashedToken) {
  return query(
    `UPDATE users
     SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL
     WHERE email_verification_token = $1 AND email_verification_expires > NOW() AND email_verified = false
     RETURNING id, email, username`,
    [hashedToken]
  ).then((r) => r.rows[0] || null);
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

async function createOAuthUser({ email, username, fullName, emailVerified, referralCode }, client) {
  const db = client || { query };
  const result = await db.query(`
    INSERT INTO users (email, password_hash, username, full_name, role, email_verified, referral_code)
    VALUES ($1, NULL, $2, $3, 'user', $4, $5)
    RETURNING id, email, username, role
  `, [email.toLowerCase(), username, fullName || null, emailVerified, referralCode]);
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
  setEmailVerificationToken,
  verifyEmailByToken,
  referralCodeExists,
  findUserByReferralCode,
  createReferral,
  completeReferral,
  getReferralStats,
  findIdentity,
  findByEmailFull,
  usernameExists,
  createOAuthUser,
  createIdentity,
};
