-- Esegui questo script nel tuo client SQL (pgAdmin, DBeaver, psql, editor SQL di Supabase)
-- connesso allo stesso database indicato in DATABASE_URL.
--
-- Aggiunge la colonna `status` se manca (PostgreSQL 11+).

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Allinea eventuali NULL dopo l'aggiunta
UPDATE listings SET status = 'active' WHERE status IS NULL;

-- Opzionale: vincolo CHECK come in schema.sql (solo se non esiste già un vincolo equivalente).
-- Se ottieni un errore perché il constraint esiste già, ignora questo blocco.
-- ALTER TABLE listings
--   ADD CONSTRAINT listings_status_check
--   CHECK (status IN ('draft','active','sold','expired','removed'));
