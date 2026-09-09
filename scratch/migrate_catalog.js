const { query } = require('./src/db');

async function migrate() {
  try {
    console.log('Starting migration...');

    // 1. Add 'names' JSONB column if it doesn't exist
    await query(`
      ALTER TABLE master_sets 
      ADD COLUMN IF NOT EXISTS names JSONB DEFAULT '{}'::jsonb
    `);
    console.log('Column "names" added/verified.');

    // 2. Enable pg_trgm extension
    await query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    console.log('Extension "pg_trgm" enabled.');

    // 3. Create helper function FIRST — required by the GIN index below.
    //    Must be IMMUTABLE to be usable in a functional index.
    await query(`
      CREATE OR REPLACE FUNCTION immutable_jsonb_values_text(j jsonb)
      RETURNS text AS $$
        SELECT string_agg(value, ' ') FROM jsonb_each_text(j)
      $$ LANGUAGE sql IMMUTABLE;
    `);
    console.log('Helper function "immutable_jsonb_values_text" created.');

    // 4. Create GIN trigram index on set_num
    await query(`
      CREATE INDEX IF NOT EXISTS idx_master_sets_set_num_trgm 
      ON master_sets USING gin (set_num gin_trgm_ops)
    `);
    console.log('Trigram index on set_num created.');

    // 5. Create GIN trigram index on multilingual names.
    //    The helper function must exist before this step.
    await query(`
      CREATE INDEX IF NOT EXISTS idx_master_sets_names_trgm 
      ON master_sets USING gin (immutable_jsonb_values_text(names) gin_trgm_ops)
    `);
    console.log('Trigram index on names created.');

    // 6. Populate sample multilingual data for testing.
    //    All 5 languages: EN, IT, FR, DE, ES

    // Disney Castle (71040)
    await query(`
      UPDATE master_sets 
      SET names = '{"en": "Disney Castle", "it": "Castello Disney", "fr": "Château Disney", "de": "Disney Schloss", "es": "Castillo Disney"}'::jsonb
      WHERE set_num = '71040-1' OR set_num = '71040'
    `);

    // Bugatti Chiron (42083)
    await query(`
      UPDATE master_sets 
      SET names = '{"en": "Bugatti Chiron", "it": "Bugatti Chiron", "fr": "Bugatti Chiron", "de": "Bugatti Chiron", "es": "Bugatti Chiron"}'::jsonb
      WHERE set_num = '42083-1' OR set_num = '42083'
    `);

    // The Mandalorian N-1 Starfighter (75325)
    await query(`
      UPDATE master_sets 
      SET names = '{"en": "The Mandalorian N-1 Starfighter", "it": "Caccia Stellare N-1 del Mandaloriano", "fr": "Le Chasseur N-1 du Mandalorien", "de": "N-1 Sternjäger des Mandalorianers", "es": "Caza Estelar N-1 del Mandaloriano"}'::jsonb
      WHERE set_num = '75325-1' OR set_num = '75325'
    `);

    console.log('Sample multilingual data populated (EN, IT, FR, DE, ES).');
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();