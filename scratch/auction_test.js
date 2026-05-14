const jwt = require('jsonwebtoken');
require('dotenv').config();

const API_BASE = 'http://localhost:3000/api';
const LISTING_ID = '49e08c15-cb43-4f56-8d38-a625e59270a3';
const TEST_USER_ID = '651334aa-0ffa-4d88-af0e-aab549bc75db'; // SwissBrick
const JWT_SECRET = process.env.JWT_SECRET || 'brickmarket_super_secret_key_2026_cambia_questa';

// Generate token for TestUser
const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET, { expiresIn: '7d' });

async function getListing() {
    const res = await fetch(`${API_BASE}/listings/${LISTING_ID}`);
    return await res.json();
}

async function placeBid(amount) {
    console.log(`[STRIKE] Placing bid of ${amount}€...`);
    const res = await fetch(`${API_BASE}/listings/${LISTING_ID}/bid`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (res.ok) {
        console.log('[SUCCESS] Bid placed! New End Time:', data.auction_end);
    } else {
        console.error('[ERROR] Bid failed:', data.error);
    }
}

async function run() {
    console.log('--- Auction Sniper Test Initiated ---');
    console.log(`Target: ${LISTING_ID}`);
    console.log(`User: testuser (${TEST_USER_ID})`);
    
    while (true) {
        const listing = await getListing();
        if (!listing.auction_end) {
            console.error('No auction_end found.');
            break;
        }

        const endTime = new Date(listing.auction_end).getTime();
        const now = new Date().getTime();
        const remainingMs = endTime - now;
        const remainingSec = Math.floor(remainingMs / 1000);

        if (remainingMs <= 0) {
            console.log('Auction already ended.');
            break;
        }

        console.log(`Remaining: ${remainingSec}s...`);

        if (remainingSec <= 90) { // Strike at 1:30 or less
            const nextBid = parseFloat(listing.current_bid || 0) + 1.0;
            await placeBid(nextBid);
            break;
        }

        await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
    }
    console.log('--- Sniper Finished ---');
}

run().catch(console.error);
