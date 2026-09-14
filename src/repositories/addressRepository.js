const { query, getClient } = require('../db');

const ADDRESS_FIELDS = `id, user_id, label, full_name, address, address_street, address_house_number,
       city, zip, province, country, phone, is_default, created_at, updated_at`;

function listByUser(userId) {
  return query(
    `SELECT ${ADDRESS_FIELDS} FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId]
  ).then((r) => r.rows);
}

function findById(userId, addressId) {
  return query(
    `SELECT ${ADDRESS_FIELDS} FROM addresses WHERE id = $1 AND user_id = $2`,
    [addressId, userId]
  ).then((r) => r.rows[0] || null);
}

// New addresses become the default automatically when it's the user's first
// one (so checkout always has one to preselect), otherwise only if asked.
async function create(userId, data) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    let makeDefault = !!data.isDefault;
    if (!makeDefault) {
      const existing = await client.query('SELECT 1 FROM addresses WHERE user_id = $1 LIMIT 1', [userId]);
      makeDefault = existing.rows.length === 0;
    }
    if (makeDefault) {
      await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [userId]);
    }

    const result = await client.query(
      `INSERT INTO addresses
         (user_id, label, full_name, address, address_street, address_house_number,
          city, zip, province, country, phone, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING ${ADDRESS_FIELDS}`,
      [
        userId, data.label || null, data.fullName, data.address || null,
        data.addressStreet, data.addressHouseNumber,
        data.city, data.zip, data.province || null, data.country, data.phone || null,
        makeDefault,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function update(userId, addressId, data) {
  const setClauses = [];
  const values = [];
  let count = 1;

  const fieldMap = {
    label: 'label', fullName: 'full_name', address: 'address',
    addressStreet: 'address_street', addressHouseNumber: 'address_house_number',
    city: 'city', zip: 'zip', province: 'province', country: 'country', phone: 'phone',
  };
  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      setClauses.push(`${column} = $${count}`);
      values.push(data[key]);
      count++;
    }
  }
  if (setClauses.length === 0) return findById(userId, addressId);

  setClauses.push(`updated_at = NOW()`);
  values.push(addressId, userId);
  const result = await query(
    `UPDATE addresses SET ${setClauses.join(', ')} WHERE id = $${count} AND user_id = $${count + 1}
     RETURNING ${ADDRESS_FIELDS}`,
    values
  );
  return result.rows[0] || null;
}

async function setDefault(userId, addressId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const owned = await client.query('SELECT 1 FROM addresses WHERE id = $1 AND user_id = $2', [addressId, userId]);
    if (owned.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [userId]);
    const result = await client.query(
      `UPDATE addresses SET is_default = TRUE, updated_at = NOW() WHERE id = $1 RETURNING ${ADDRESS_FIELDS}`,
      [addressId]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function remove(userId, addressId) {
  const result = await query(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id, is_default',
    [addressId, userId]
  );
  const deleted = result.rows[0];
  if (deleted?.is_default) {
    // Promote the most recently added remaining address so checkout still
    // has a default to preselect.
    await query(
      `UPDATE addresses SET is_default = TRUE
       WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
      [userId]
    );
  }
  return !!deleted;
}

module.exports = {
  listByUser,
  findById,
  create,
  update,
  setDefault,
  remove,
};
