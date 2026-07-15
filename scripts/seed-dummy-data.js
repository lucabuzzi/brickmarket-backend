/**
 * Popola utenti e annunci demo (idempotente).
 * Supporta sia lo schema nuovo (schema.sql) sia DB legacy (category, location, type fixed).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DEMO_TAG = '__DEMO_SEED__';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

const demoUsers = [
  {
    email: 'seller@demo.brickmarket',
    username: 'demo_seller',
    fullName: 'Alex Demo',
    role: 'both',
    city: 'Milano',
  },
  {
    email: 'buyer@demo.brickmarket',
    username: 'demo_buyer',
    fullName: 'Blu Demo',
    role: 'buyer',
    city: 'Roma',
  },
];

async function getListingColumns(client) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'listings'`
  );
  return new Set(r.rows.map((x) => x.column_name));
}

const legacyRows = (sellerId) => [
  {
    title: 'Millennium Falcon UCS',
    description: `Replica dettagliata, istruzioni e minifigure. ${DEMO_TAG}`,
    price: 649.99,
    category: 'sets',
    condition: 'used',
    location: 'Italia',
    type: 'used',
    image_url: 'https://picsum.photos/seed/bm1/800/600',
  },
  {
    title: 'Castello Disney sigillato',
    description: `Nuovo, mai aperto. ${DEMO_TAG}`,
    price: 289.0,
    category: 'sets',
    condition: 'new',
    location: 'Italia',
    type: 'sealed',
    image_url: 'https://picsum.photos/seed/bm3/800/600',
  },
  {
    title: 'Modulare Piazza centrale',
    description: `Usato, completo al 100%. ${DEMO_TAG}`,
    price: 175.5,
    category: 'sets',
    condition: 'used',
    location: 'Italia',
    type: 'used',
    image_url: 'https://picsum.photos/seed/bm4/800/600',
  },
  {
    title: 'Speed Champions Ferrari',
    description: `Sigillato, scatola perfetta. ${DEMO_TAG}`,
    price: 24.99,
    category: 'sets',
    condition: 'new',
    location: 'Italia',
    type: 'sealed',
    image_url: 'https://picsum.photos/seed/bm8/800/600',
  },
  {
    title: 'Asta — Collezione Ideas',
    description: `Asta demo (Attiva). ${DEMO_TAG}`,
    price: null,
    category: 'sets',
    condition: 'new',
    location: 'Italia',
    type: 'auction',
    image_url: 'https://picsum.photos/seed/bm7/800/600',
  },
  {
    title: 'Asta — Torre Eiffel (Scaduta)',
    description: `Asta terminata per i test. ${DEMO_TAG}`,
    price: null,
    category: 'sets',
    condition: 'used',
    location: 'Italia',
    type: 'auction',
    image_url: 'https://picsum.photos/seed/bm11/800/600',
  },
];

const modernRows = (sellerId) => [
  {
    title: 'Millennium Falcon UCS',
    description: `Replica dettagliata, istruzioni e minifigure. ${DEMO_TAG}`,
    set_number: '75192',
    theme: 'Star Wars',
    year: 2017,
    pieces: 7541,
    type: 'used',
    condition: 'complete',
    price: 649.99,
    shipping_cost: 12.9,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: [
      'https://picsum.photos/seed/bm1/800/600',
      'https://picsum.photos/seed/bm2/800/600',
    ],
  },
  {
    title: 'Castello Disney sigillato',
    description: `Nuovo, mai aperto. ${DEMO_TAG}`,
    set_number: '43222',
    theme: 'Disney',
    year: 2020,
    pieces: 4080,
    type: 'sealed',
    condition: 'complete',
    price: 289.0,
    shipping_cost: 9.9,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm3/800/600'],
  },
  {
    title: 'Modulare Piazza centrale',
    description: `Usato, completo al 100%. ${DEMO_TAG}`,
    set_number: '10255',
    theme: 'City',
    year: 2017,
    pieces: 4002,
    type: 'used',
    condition: 'good',
    price: 175.5,
    shipping_cost: 11.0,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: [
      'https://picsum.photos/seed/bm4/800/600',
      'https://picsum.photos/seed/bm5/800/600',
    ],
  },
  {
    title: 'MOC nave spaziale custom',
    description: `MOC originale, pezzi misti. ${DEMO_TAG}`,
    theme: 'Space',
    year: 2024,
    pieces: 850,
    type: 'moc',
    condition: 'good',
    price: 89.0,
    shipping_cost: 7.5,
    shipping_method: 'Posta',
    category: 'mocs',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm6/800/600'],
  },
  {
    title: 'Asta — Collezione Ideas',
    description: `Asta demo (Attiva). ${DEMO_TAG}`,
    theme: 'Ideas',
    year: 2023,
    type: 'auction',
    condition: 'complete',
    auction_start: 45.0,
    auction_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    auction_reserve: 80.0,
    shipping_cost: 6.0,
    shipping_method: 'Ritiro',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm7/800/600'],
  },
  {
    title: 'Asta — Rivendell LOTR',
    description: `Asta demo (Attiva). ${DEMO_TAG}`,
    theme: 'Lord of the Rings',
    year: 2023,
    type: 'auction',
    condition: 'new',
    auction_start: 350.0,
    auction_end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    shipping_cost: 15.0,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm10/800/600'],
  },
  {
    title: 'Asta Concorrente Rapida 5m',
    description: `Asta a scadenza molto breve (5 minuti) per testare la concorrenza. ${DEMO_TAG}`,
    theme: 'Speed Champions',
    year: 2024,
    type: 'auction',
    condition: 'new',
    auction_start: 15.0,
    auction_end: new Date(Date.now() + 5 * 60 * 1000),
    auction_reserve: 25.0,
    shipping_cost: 5.5,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm12/800/600'],
  },
  {
    title: 'Asta Concorrente Rapida 10m',
    description: `Asta a scadenza molto breve (10 minuti) per testare la concorrenza. ${DEMO_TAG}`,
    theme: 'Technic',
    year: 2024,
    type: 'auction',
    condition: 'new',
    auction_start: 30.0,
    auction_end: new Date(Date.now() + 10 * 60 * 1000),
    auction_reserve: 50.0,
    shipping_cost: 7.5,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm13/800/600'],
  },
  {
    title: 'Asta — Torre Eiffel (Scaduta)',
    description: `Asta terminata per i test. ${DEMO_TAG}`,
    theme: 'Architecture',
    year: 2022,
    type: 'auction',
    condition: 'complete',
    auction_start: 500.0,
    auction_end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Nel passato
    current_bid: 550.0,
    bids_count: 2,
    status: 'expired',
    shipping_cost: 20.0,
    shipping_method: 'Corriere',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm11/800/600'],
  },
  {
    title: 'Speed Champions Ferrari (Venduto)',
    description: `Sigillato, scatola perfetta. ${DEMO_TAG}`,
    set_number: '76914',
    theme: 'Speed Champions',
    year: 2023,
    pieces: 262,
    type: 'sealed',
    condition: 'complete',
    price: 24.99,
    status: 'sold',
    shipping_cost: 5.0,
    shipping_method: 'Posta',
    category: 'sets',
    location: 'Italia',
    images: ['https://picsum.photos/seed/bm8/800/600'],
  },
];

async function deleteDemoListings(client, cols) {
  if (cols.has('description')) {
    await client.query(`DELETE FROM listings WHERE description LIKE $1`, [`%${DEMO_TAG}%`]);
  }
}

async function insertLegacy(client, sellerId, cols) {
  for (const L of legacyRows(sellerId)) {
    if (cols.has('image_url')) {
      await client.query(
        `INSERT INTO listings (
          seller_id, title, description, price, category, condition, location, type, image_url
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          sellerId,
          L.title,
          L.description,
          L.price,
          L.category,
          L.condition,
          L.location,
          L.type,
          L.image_url,
        ]
      );
    } else if (cols.has('images')) {
      await client.query(
        `INSERT INTO listings (
          seller_id, title, description, price, category, condition, location, type, images
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          sellerId,
          L.title,
          L.description,
          L.price,
          L.category,
          L.condition,
          L.location,
          L.type,
          [L.image_url],
        ]
      );
    } else {
      await client.query(
        `INSERT INTO listings (
          seller_id, title, description, price, category, condition, location, type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          sellerId,
          L.title,
          L.description,
          L.price,
          L.category,
          L.condition,
          L.location,
          L.type,
        ]
      );
    }
  }
}

async function insertModern(client, sellerId, cols) {
  const hasCategory = cols.has('category');
  const hasLocation = cols.has('location');

  for (const L of modernRows(sellerId)) {
    const fields = [
      'seller_id', 'title', 'description', 'set_number', 'theme', 'year', 'pieces',
      'type', 'condition', 'price', 'auction_start', 'auction_end', 'auction_reserve',
      'current_bid', 'status', 'images', 'shipping_cost', 'shipping_method'
    ];
    const vals = [
      sellerId,
      L.title,
      L.description,
      L.set_number || null,
      L.theme || null,
      L.year ?? null,
      L.pieces ?? null,
      L.type,
      L.condition,
      L.type === 'auction' ? null : L.price,
      L.type === 'auction' ? L.auction_start : null,
      L.type === 'auction' ? L.auction_end : null,
      L.type === 'auction' ? (L.auction_reserve ?? null) : null,
      L.type === 'auction' ? L.auction_start : null,
      L.status || 'active',
      L.images,
      L.shipping_cost,
      L.shipping_method
    ];

    if (hasCategory) {
      fields.push('category');
      vals.push(L.category || 'sets');
    }
    if (hasLocation) {
      fields.push('location');
      vals.push(L.location || 'Italia');
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const queryStr = `INSERT INTO listings (${fields.join(',')}) VALUES (${placeholders})`;
    await client.query(queryStr, vals);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL mancante nel file .env');
    process.exit(1);
  }

  const passwordPlain = 'Demo1234!';
  const passwordHash = await bcrypt.hash(passwordPlain, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cols = await getListingColumns(client);
    const isLegacy = !cols.has('theme') || !cols.has('auction_end');

    const ids = {};
    for (const u of demoUsers) {
      const r = await client.query(
        `INSERT INTO users (email, password_hash, username, full_name, role, city)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           username = EXCLUDED.username,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           city = EXCLUDED.city
         RETURNING id, email`,
        [u.email, passwordHash, u.username, u.fullName, u.role, u.city]
      );
      ids[u.email] = r.rows[0].id;
    }

    const sellerId = ids['seller@demo.brickmarket'];

    await deleteDemoListings(client, cols);

    if (isLegacy) {
      console.log('Schema listings: legacy (category/location) — inserimento demo compatibile.');
      await insertLegacy(client, sellerId, cols);
    } else {
      console.log('Schema listings: moderno (schema.sql) — inserimento demo completo.');
      await insertModern(client, sellerId, cols);
    }

    await client.query('COMMIT');
    console.log('Seed demo completato.');
    console.log('Account (password per entrambi: Demo1234!):');
    console.log('  seller@demo.brickmarket  (venditore)');
    console.log('  buyer@demo.brickmarket   (acquirente)');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed fallito:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
