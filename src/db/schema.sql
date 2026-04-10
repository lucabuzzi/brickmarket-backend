-- Abilita UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- UTENTI
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username      VARCHAR(100) UNIQUE NOT NULL,
  full_name     VARCHAR(200),
  role          VARCHAR(20) DEFAULT 'buyer' CHECK (role IN ('buyer','seller','both','admin')),
  city          VARCHAR(100),
  avatar_url    TEXT,

  -- Campi venditore
  fiscal_code   VARCHAR(20),
  iban          VARCHAR(34),
  seller_type   VARCHAR(20) CHECK (seller_type IN ('private','professional')),

  -- Stripe Connect (per i pagamenti ai venditori)
  stripe_account_id   VARCHAR(100),
  stripe_account_status VARCHAR(20) DEFAULT 'pending',

  -- PayPal
  paypal_email  VARCHAR(255),

  -- Statistiche
  rating_avg    DECIMAL(3,2) DEFAULT 0,
  rating_count  INTEGER DEFAULT 0,
  sales_count   INTEGER DEFAULT 0,
  is_verified   BOOLEAN DEFAULT FALSE,

  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ANNUNCI
CREATE TABLE listings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title         VARCHAR(300) NOT NULL,
  description   TEXT,
  set_number    VARCHAR(20),
  theme         VARCHAR(100),
  year          INTEGER,
  pieces        INTEGER,

  type          VARCHAR(20) NOT NULL CHECK (type IN ('used','sealed','moc','auction')),
  condition     VARCHAR(20) CHECK (condition IN ('complete','good','fair','parts')),

  price         DECIMAL(10,2),               -- prezzo fisso
  auction_start DECIMAL(10,2),               -- base d'asta
  auction_end   TIMESTAMP,                   -- scadenza asta
  auction_reserve DECIMAL(10,2),             -- prezzo di riserva
  current_bid   DECIMAL(10,2),               -- offerta attuale
  bids_count    INTEGER DEFAULT 0,

  status        VARCHAR(20) DEFAULT 'active'
                CHECK (status IN ('draft','active','sold','expired','removed')),

  images        TEXT[],                      -- array di URL Cloudinary
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  shipping_method VARCHAR(50),

  views_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- OFFERTE ASTA
CREATE TABLE bids (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  bidder_id   UUID NOT NULL REFERENCES users(id),
  amount      DECIMAL(10,2) NOT NULL,
  is_winning  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ORDINI
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id        UUID NOT NULL REFERENCES users(id),
  seller_id       UUID NOT NULL REFERENCES users(id),
  listing_id      UUID NOT NULL REFERENCES listings(id),

  -- Importi
  item_price      DECIMAL(10,2) NOT NULL,
  shipping_cost   DECIMAL(10,2) DEFAULT 0,
  platform_fee    DECIMAL(10,2) NOT NULL,    -- 5% a carico acquirente
  seller_fee      DECIMAL(10,2) NOT NULL,    -- 5% detratto al venditore
  total_buyer     DECIMAL(10,2) NOT NULL,    -- quanto paga l'acquirente
  seller_payout   DECIMAL(10,2) NOT NULL,    -- quanto riceve il venditore

  -- Stato
  status          VARCHAR(30) DEFAULT 'pending_payment'
                  CHECK (status IN (
                    'pending_payment',
                    'payment_received',
                    'preparing',
                    'shipped',
                    'delivered',
                    'confirmed',             -- acquirente conferma ricezione
                    'completed',             -- fondi liberati al venditore
                    'disputed',
                    'refunded',
                    'cancelled'
                  )),

  -- Stripe
  stripe_payment_intent_id  VARCHAR(100),
  stripe_transfer_id        VARCHAR(100),    -- bonifico al venditore
  payment_gateway           VARCHAR(20) DEFAULT 'stripe',

  -- PayPal
  paypal_order_id           VARCHAR(100),
  paypal_capture_id         VARCHAR(100),

  -- Spedizione
  tracking_number           VARCHAR(100),
  carrier                   VARCHAR(50),
  shipped_at                TIMESTAMP,
  delivered_at              TIMESTAMP,
  confirmed_at              TIMESTAMP,

  -- Note
  shipping_address          JSONB,           -- snapshot indirizzo al momento ordine
  buyer_notes               TEXT,

  -- Scadenze
  confirm_deadline          TIMESTAMP,       -- acquirente ha 5 giorni per confermare

  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

-- RECENSIONI
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewed_id UUID NOT NULL REFERENCES users(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(order_id, reviewer_id)
);

-- INDIRIZZI
CREATE TABLE addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name   VARCHAR(200),
  address     VARCHAR(300),
  city        VARCHAR(100),
  zip         VARCHAR(10),
  province    VARCHAR(5),
  phone       VARCHAR(20),
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- WATCHLIST
CREATE TABLE watchlist (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

-- INDICI per performance
CREATE INDEX idx_listings_seller   ON listings(seller_id);
CREATE INDEX idx_listings_status   ON listings(status);
CREATE INDEX idx_listings_type     ON listings(type);
CREATE INDEX idx_orders_buyer      ON orders(buyer_id);
CREATE INDEX idx_orders_seller     ON orders(seller_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_bids_listing      ON bids(listing_id);