/**
 * Migration: Set up the reviews system.
 * - Ensures the reviews table & constraints exist (idempotent).
 * - Creates a DB function + trigger to keep rating_avg/rating_count
 *   on the users table in sync whenever a review is inserted/deleted.
 * - Adds performance indices.
 *
 * Run with: node src/db/migrate_reviews.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running reviews migration...');

  // 1. Ensure reviews table exists (schema.sql may have created it already)
  await query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id      UUID NOT NULL REFERENCES orders(id),
      reviewer_id   UUID NOT NULL REFERENCES users(id),
      reviewed_id   UUID NOT NULL REFERENCES users(id),
      rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment       TEXT,
      created_at    TIMESTAMP DEFAULT NOW(),
      -- Core security: one review per (order, reviewer) pair
      UNIQUE(order_id, reviewer_id)
    );
  `);

  // 2. Indices for fast lookups
  await query(`
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_id
    ON reviews(reviewed_id);
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id
    ON reviews(reviewer_id);
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_reviews_order_id
    ON reviews(order_id);
  `);

  // 3. PL/pgSQL function to recompute avg & count for a user
  await query(`
    CREATE OR REPLACE FUNCTION refresh_user_rating(uid UUID)
    RETURNS VOID AS $$
    BEGIN
      UPDATE users
      SET
        rating_avg   = COALESCE((
          SELECT ROUND(AVG(rating)::NUMERIC, 2)
          FROM reviews
          WHERE reviewed_id = uid
        ), 0),
        rating_count = (
          SELECT COUNT(*)
          FROM reviews
          WHERE reviewed_id = uid
        ),
        updated_at = NOW()
      WHERE id = uid;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 4. Trigger function that calls refresh_user_rating after INSERT or DELETE
  await query(`
    CREATE OR REPLACE FUNCTION trg_refresh_user_rating()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        PERFORM refresh_user_rating(OLD.reviewed_id);
        RETURN OLD;
      ELSE
        PERFORM refresh_user_rating(NEW.reviewed_id);
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 5. Attach trigger to reviews table (drop first to allow idempotent re-runs)
  await query(`DROP TRIGGER IF EXISTS trg_reviews_rating ON reviews;`);
  await query(`
    CREATE TRIGGER trg_reviews_rating
    AFTER INSERT OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_refresh_user_rating();
  `);

  console.log('✅  Reviews migration complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
