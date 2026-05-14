-- Allinea il vincolo listings_type_check a src/db/schema.sql:
--   type IN ('used','sealed','moc','auction')
--
-- Esegui sul database usato da DATABASE_URL (Supabase SQL, pgAdmin, psql).
-- Se avevi il vecchio valore 'fixed', aggiorna le righe prima di ricreare il CHECK.

-- 1) Rimuovi il vincolo esistente (nome tipico PostgreSQL)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_type_check;

-- 2) Normalizza dati legacy
UPDATE listings SET type = 'used' WHERE type = 'fixed';

-- 3) Ricrea il vincolo come in schema.sql
ALTER TABLE listings
  ADD CONSTRAINT listings_type_check
  CHECK (type IN ('used', 'sealed', 'moc', 'auction'));
