require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function deduplicate() {
  try {
    console.log('--- STARTING DEDUPLICATION ---');
    
    // Find duplicates: groups with same seller_id, title, description
    const res = await pool.query(`
      SELECT seller_id, title, description, COUNT(*) as count
      FROM listings
      WHERE status <> 'removed'
      GROUP BY seller_id, title, description
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${res.rows.length} duplicate groups.`);

    for (const group of res.rows) {
      console.log(`Cleaning group: "${group.title}" for seller ${group.seller_id} (${group.count} copies)`);
      
      // Get all IDs in this group, ordered by created_at DESC
      const groupItems = await pool.query(`
        SELECT id FROM listings
        WHERE seller_id = $1 
          AND title = $2 
          AND (description = $3 OR (description IS NULL AND $3 IS NULL))
          AND status <> 'removed'
        ORDER BY created_at DESC
      `, [group.seller_id, group.title, group.description]);

      if (groupItems.rows.length > 1) {
        const idsToDelete = groupItems.rows.slice(1).map(r => r.id);
        console.log(`  -> Deleting ${idsToDelete.length} duplicates...`);
        
        await pool.query(`
          DELETE FROM listings
          WHERE id = ANY($1)
        `, [idsToDelete]);
      }
    }

    console.log('--- DEDUPLICATION COMPLETE ---');
  } catch (err) {
    console.error('Error during deduplication:', err);
  } finally {
    await pool.end();
  }
}

deduplicate();
