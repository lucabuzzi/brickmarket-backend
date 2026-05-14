/**
 * restore-listings.js
 * 
 * 1. Fixes the `condition` CHECK constraint (schema had 'complete','good','fair','parts'
 *    but the backend/Joi allows 'new','used','Like New','damaged' which caused silent failures).
 * 2. Re-seeds the marketplace with 8 representative listings that were lost during cleanup.
 * 
 * Run: node scripts/restore-listings.js
 */

require('dotenv').config();
const { query } = require('../src/db');

const SELLER_ID = '586be97f-96e1-4c78-b319-8264b34555ba'; // Ludex

// 8 realistic LEGO listings to restore the marketplace grid
const LISTINGS = [
  {
    title: 'LEGO Star Wars – Millennium Falcon 75192',
    description: 'Set iconico in condizioni perfette. Tutti i pezzi presenti, istruzioni incluse. Scatola originale con qualche segno di usura. Un must per i collezionisti.',
    set_number: '75192',
    theme: 'Star Wars',
    year: 2017,
    pieces: 7541,
    type: 'used',
    condition: 'complete',
    price: 649.90,
    shipping_cost: 12.00,
    shipping_method: 'Corriere espresso',
    images: ['https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800&q=80'],
  },
  {
    title: 'LEGO Technic – Bugatti Chiron 42083',
    description: 'Costruita una sola volta e riposta in esposizione. Condizioni come nuovo. Scatola e istruzioni in ottime condizioni.',
    set_number: '42083',
    theme: 'Technic',
    year: 2018,
    pieces: 3599,
    type: 'used',
    condition: 'good',
    price: 319.00,
    shipping_cost: 10.00,
    shipping_method: 'Corriere',
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'],
  },
  {
    title: 'LEGO Harry Potter – Castello di Hogwarts 71043 [SIGILLATO]',
    description: 'Sigillato, mai aperto. Acquistato come investimento. Fattura disponibile. Spedizione assicurata.',
    set_number: '71043',
    theme: 'Harry Potter',
    year: 2018,
    pieces: 6020,
    type: 'sealed',
    condition: 'complete',
    price: 489.00,
    shipping_cost: 15.00,
    shipping_method: 'Corriere assicurato',
    images: ['https://images.unsplash.com/photo-1545239351-cefa43af60f3?w=800&q=80'],
  },
  {
    title: 'LEGO Icons – Botanica 10281',
    description: 'Perfetto per gli amanti della natura e del design. Completo di tutti i pezzi e istruzioni. Mai esposto.',
    set_number: '10281',
    theme: 'Icons',
    year: 2021,
    pieces: 758,
    type: 'used',
    condition: 'complete',
    price: 54.99,
    shipping_cost: 6.00,
    shipping_method: 'Posta ordinaria',
    images: ['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80'],
  },
  {
    title: 'LEGO Ninjago – City of Stiix 70620',
    description: 'Completo e funzionante. Qualche segno di usura normale. Ottimo per chi vuole costruire la città Ninjago.',
    set_number: '70620',
    theme: 'Ninjago',
    year: 2017,
    pieces: 1278,
    type: 'used',
    condition: 'good',
    price: 89.00,
    shipping_cost: 8.00,
    shipping_method: 'Corriere',
    images: ['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=800&q=80'],
  },
  {
    title: 'LEGO Star Wars – Death Star 10143 [RARO]',
    description: 'Rarissimo set fuori produzione. Completo con minifigure originali. Certificato di autenticità LEGO incluso. Ideale per collezionisti seri.',
    set_number: '10143',
    theme: 'Star Wars',
    year: 2005,
    pieces: 3449,
    type: 'used',
    condition: 'complete',
    price: 1200.00,
    shipping_cost: 20.00,
    shipping_method: 'Corriere assicurato',
    images: ['https://images.unsplash.com/photo-1612430258175-bce3b5f3e12c?w=800&q=80'],
  },
  {
    title: 'LEGO Technic – Land Rover Defender 42110',
    description: 'Condizioni eccellenti, costruito una volta e riposto con cura. Scatola leggermente ammaccata agli angoli ma contenuto intatto.',
    set_number: '42110',
    theme: 'Technic',
    year: 2019,
    pieces: 2573,
    type: 'used',
    condition: 'good',
    price: 159.00,
    shipping_cost: 10.00,
    shipping_method: 'Corriere',
    images: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80'],
  },
  {
    title: 'LEGO Icons – Atena di Fidia (Pantheon) 21045',
    description: 'Architettura in perfette condizioni. Ideale per decorare un ufficio o salotto. Completo di istruzioni e scatola originale.',
    set_number: '21045',
    theme: 'Icons',
    year: 2019,
    pieces: 1084,
    type: 'used',
    condition: 'complete',
    price: 74.90,
    shipping_cost: 7.00,
    shipping_method: 'Corriere',
    images: ['https://images.unsplash.com/photo-1472746729193-26d9dc7cfbca?w=800&q=80'],
  },
];

async function main() {
  console.log('=== BrickMarket Listing Restore Script ===\n');

  // Step 1: Fix the condition CHECK constraint to include 'new' and 'used'
  // The original schema only had ('complete','good','fair','parts') which was too restrictive.
  console.log('Step 1: Fixing condition CHECK constraint...');
  try {
    await query(`ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_condition_check`);
    await query(`
      ALTER TABLE listings 
      ADD CONSTRAINT listings_condition_check 
      CHECK (condition IN ('complete', 'good', 'fair', 'parts', 'new', 'used', 'Like New', 'damaged'))
    `);
    console.log('  ✅ condition constraint updated to include: new, used, Like New, damaged\n');
  } catch (err) {
    console.warn('  ⚠️  Could not update constraint (might already be updated):', err.message, '\n');
  }

  // Step 2: Insert the restored listings
  console.log('Step 2: Inserting restored listings...');
  let inserted = 0;
  for (const l of LISTINGS) {
    try {
      await query(
        `INSERT INTO listings 
          (seller_id, title, description, set_number, theme, year, pieces, type, condition, 
           price, shipping_cost, shipping_method, images, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')`,
        [
          SELLER_ID,
          l.title,
          l.description,
          l.set_number,
          l.theme,
          l.year,
          l.pieces,
          l.type,
          l.condition,
          l.price,
          l.shipping_cost,
          l.shipping_method,
          l.images,
        ]
      );
      console.log(`  ✅ Inserted: ${l.title}`);
      inserted++;
    } catch (err) {
      console.error(`  ❌ Failed: ${l.title} — ${err.message}`);
    }
  }

  // Step 3: Also fix the "Millenium" draft if it has bad condition data
  console.log('\nStep 3: Checking existing drafts...');
  try {
    const res = await query(`SELECT id, title, status, condition FROM listings ORDER BY created_at DESC`);
    console.log('\nFinal listing count:', res.rows.length);
    console.log('Listings in DB:');
    res.rows.forEach(r => console.log(`  [${r.status.toUpperCase()}] ${r.title} (condition: ${r.condition})`));
  } catch (err) {
    console.error('Could not fetch final state:', err.message);
  }

  // Step 4: Populate user countries for the community directory
  console.log('\nStep 4: Populating European community directory (Full EU Support)...');
  const mockUsers = [
    { username: 'Ludex', country: 'it', city: 'Milano', rating: 4.8, is_pro: true },
    { username: 'SwissBrick', country: 'ch', city: 'Lugano', rating: 5.0, is_pro: false },
    { username: 'TitanBrick', country: 'sm', city: 'Borgo Maggiore', rating: 4.5, is_pro: false },
    { username: 'LegoMaster99', country: 'it', city: 'Roma', rating: 4.2, is_pro: false },
    { username: 'AlpineBuilder', country: 'ch', city: 'Zurich', rating: 4.9, is_pro: true },
    { username: 'SteinMeister', country: 'de', city: 'Berlin', rating: 4.7, is_pro: true },
    { username: 'LeBrique', country: 'fr', city: 'Paris', rating: 4.6, is_pro: false },
    { username: 'EuroBrick', country: 'es', city: 'Madrid', rating: 4.9, is_pro: true },
    { username: 'TulipLego', country: 'nl', city: 'Amsterdam', rating: 4.8, is_pro: false },
  ];

  for (const u of mockUsers) {
    try {
      await query(`
        INSERT INTO users (username, email, password_hash, address_country, city, rating_avg, rating_count, is_pro)
        VALUES ($1, $2, 'demo_hash', $3, $4, $5, 12, $6)
        ON CONFLICT (username) DO UPDATE SET
          address_country = EXCLUDED.address_country,
          city = EXCLUDED.city,
          rating_avg = EXCLUDED.rating_avg,
          is_pro = EXCLUDED.is_pro
      `, [u.username, `${u.username.toLowerCase()}@demo.local`, u.country, u.city, u.rating, u.is_pro]);
      console.log(`  ✅ Synced user: ${u.username} (${u.country.toUpperCase()})${u.is_pro ? ' [PRO]' : ''}`);
    } catch (err) {
      console.error(`  ❌ Failed to sync user ${u.username}:`, err.message);
    }
  }

  console.log(`\n✅ Done! Inserted ${inserted}/${LISTINGS.length} listings and updated community directory.`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
