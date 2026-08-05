const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
let pool = null;
let isMock = false;

// In-memory Database Mock for running without PostgreSQL/Supabase configuration
const mockDb = {
  profiles: [],
  user_wallets: {}, // key: user_id -> { user_id, balance_credits }
  credit_transactions: [],
  products: [],
  auctions: [],
  contests: [],
  contest_participants: []
};

// Seed initial mock data for local testing
const seedMockData = () => {
  const p1 = {
    id: 'p1000000-0000-0000-0000-000000000001',
    title: 'LEGO Star Wars Millennium Falcon 75192 (UCS)',
    description: 'Ultimate Collector Series Millennium Falcon. Features 7,541 pieces, realistic exterior detailing, and multiple minifigures. Sealed in original box.',
    image_url: 'https://images.unsplash.com/photo-1585366119957-e5733f399863?auto=format&fit=crop&w=800&q=80',
    category: 'lego',
    market_value: 850.00,
    condition: 'New Sealed (MISB)',
    grading_info: 'Collector Condition 10/10',
    stock: 2
  };

  const p2 = {
    id: 'p1000000-0000-0000-0000-000000000002',
    title: 'Pokémon TCG 1999 Charizard Base Set Holo #4',
    description: 'The holy grail of Pokémon cards. Original Base Set Charizard with brilliant holographics and pristine corners.',
    image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    category: 'pokemon',
    market_value: 1500.00,
    condition: 'Graded Gem Mint',
    grading_info: 'PSA 10 Gem Mint',
    stock: 1
  };

  const p3 = {
    id: 'p1000000-0000-0000-0000-000000000003',
    title: 'LEGO Creator Expert Titanic 10294',
    description: 'A historical masterpiece. 1:200 scale model of the Titanic, featuring three sections, detailed interior, and working engines.',
    image_url: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?auto=format&fit=crop&w=800&q=80',
    category: 'lego',
    market_value: 680.00,
    condition: 'New in Box',
    grading_info: 'Minor box wear',
    stock: 5
  };

  const p4 = {
    id: 'p1000000-0000-0000-0000-000000000004',
    title: 'Pokémon TCG Lugia Neo Genesis Holo #9',
    description: 'First Edition Lugia from the Neo Genesis set. Exceptionally clean print, minimal silvering, and strong centering.',
    image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    category: 'pokemon',
    market_value: 950.00,
    condition: 'Graded Mint',
    grading_info: 'BGS 9.5 Mint',
    stock: 1
  };

  mockDb.products.push(p1, p2, p3, p4);

  // Seed Live Auctions
  mockDb.auctions.push({
    id: 'a1000000-0000-0000-0000-000000000001',
    product_id: p1.id,
    current_bid: 700.00,
    highest_bidder_id: null,
    buy_now_price: 900.00,
    ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    status: 'active'
  });

  mockDb.auctions.push({
    id: 'a1000000-0000-0000-0000-000000000002',
    product_id: p2.id,
    current_bid: 1200.00,
    highest_bidder_id: null,
    buy_now_price: 1600.00,
    ends_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes from now (Hype auction!)
    status: 'active'
  });

  // Seed Skill Zone Contests
  mockDb.contests.push({
    id: 'c1000000-0000-0000-0000-000000000001',
    product_id: p3.id,
    total_slots: 10,
    filled_slots: 6,
    slot_cost_credits: 80.00,
    status: 'open',
    winner_id: null
  });

  mockDb.contests.push({
    id: 'c1000000-0000-0000-0000-000000000002',
    product_id: p4.id,
    total_slots: 5,
    filled_slots: 4,
    slot_cost_credits: 200.00,
    status: 'open',
    winner_id: null
  });
};

if (connectionString) {
  console.log('Connecting to database: postgresql pool...');
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.warn('⚠️ DATABASE_URL is not set. Initializing Mock/In-Memory database fallback...');
  isMock = true;
  seedMockData();
}

// SQL query interceptor and simple state simulator for developer comfort
const mockQuery = async (text, params = []) => {
  const normText = text.replace(/\s+/g, ' ').trim().toLowerCase();

  // 1. SIGNUP: insert into public.profiles
  if (normText.startsWith('insert into public.profiles')) {
    let id, username, email, password_hash, role;
    if (params.length === 5) {
      [id, username, email, password_hash, role] = params;
    } else if (params.length === 4) {
      [id, username, email, password_hash] = params;
      role = 'user';
    } else {
      [id, username, email, role] = params;
    }
    const profile = { id, username, email, password_hash, role: role || 'user', created_at: new Date().toISOString() };
    mockDb.profiles.push(profile);
    
    // Auto-create wallet on profile insert
    mockDb.user_wallets[id] = {
      user_id: id,
      balance_credits: 100.00, // Welcome balance
      updated_at: new Date().toISOString()
    };
    return { rows: [profile] };
  }

  // 2. LOGIN / USER INFO: select * from public.profiles
  if (normText.startsWith('select * from public.profiles where email =')) {
    const email = params[0];
    const user = mockDb.profiles.find(p => p.email === email);
    return { rows: user ? [user] : [] };
  }
  if (normText.startsWith('select * from public.profiles where id =')) {
    const id = params[0];
    const user = mockDb.profiles.find(p => p.id === id);
    return { rows: user ? [user] : [] };
  }

  // 3. WALLET BALANCE: select * from public.user_wallets where user_id =
  if (normText.includes('from public.user_wallets') && normText.includes('user_id =')) {
    const userId = params[0];
    const wallet = mockDb.user_wallets[userId] || { user_id: userId, balance_credits: 0.00 };
    return { rows: [wallet] };
  }

  // 4. TRANSACTIONS: select * from public.credit_transactions
  if (normText.includes('from public.credit_transactions') && normText.includes('user_id =') && !normText.startsWith('insert')) {
    const userId = params[0];
    const txs = mockDb.credit_transactions
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: txs };
  }

  // 5. INSERT TRANSACTION: insert into public.credit_transactions
  if (normText.startsWith('insert into public.credit_transactions')) {
    // fields: user_id, amount, type, reference_id
    const [userId, amount, type, referenceId] = params;
    const tx = {
      id: Math.random().toString(36).substring(2, 15),
      user_id: userId,
      amount: parseFloat(amount),
      type,
      reference_id: referenceId,
      created_at: new Date().toISOString()
    };
    mockDb.credit_transactions.push(tx);
    return { rows: [tx] };
  }

  // 6. UPDATE WALLET: update public.user_wallets
  if (normText.includes('update public.user_wallets set balance_credits = balance_credits +')) {
    const [amount, userId] = params;
    if (!mockDb.user_wallets[userId]) {
      mockDb.user_wallets[userId] = { user_id: userId, balance_credits: 0.00 };
    }
    mockDb.user_wallets[userId].balance_credits = parseFloat(mockDb.user_wallets[userId].balance_credits) + parseFloat(amount);
    mockDb.user_wallets[userId].updated_at = new Date().toISOString();
    return { rows: [mockDb.user_wallets[userId]] };
  }

  if (normText.includes('update public.user_wallets set balance_credits = balance_credits -')) {
    const [amount, userId] = params;
    if (!mockDb.user_wallets[userId] || mockDb.user_wallets[userId].balance_credits < amount) {
      throw new Error('Insufficient wallet balance');
    }
    mockDb.user_wallets[userId].balance_credits = parseFloat(mockDb.user_wallets[userId].balance_credits) - parseFloat(amount);
    mockDb.user_wallets[userId].updated_at = new Date().toISOString();
    return { rows: [mockDb.user_wallets[userId]] };
  }

  // 7. GET PRODUCTS: select * from public.products
  if (normText.startsWith('select * from public.products')) {
    if (normText.includes('where id =')) {
      const id = params[0];
      const prod = mockDb.products.find(p => p.id === id);
      return { rows: prod ? [prod] : [] };
    }
    return { rows: mockDb.products };
  }

  // 8. GET AUCTIONS: select a.*, p.title...
  if (normText.includes('from public.auctions a') && normText.includes('join public.products p')) {
    const list = mockDb.auctions.map(a => {
      const p = mockDb.products.find(prod => prod.id === a.product_id);
      return {
        ...a,
        title: p ? p.title : '',
        description: p ? p.description : '',
        image_url: p ? p.image_url : '',
        category: p ? p.category : 'lego',
        market_value: p ? p.market_value : 0.0,
        condition: p ? p.condition : '',
        grading_info: p ? p.grading_info : ''
      };
    });
    return { rows: list };
  }

  // 9. SUBMIT BID: update public.auctions
  if (normText.startsWith('update public.auctions set current_bid =')) {
    // UPDATE public.auctions SET current_bid = $1, highest_bidder_id = $2 WHERE id = $3
    const [bid, bidderId, auctionId] = params;
    const auction = mockDb.auctions.find(a => a.id === auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (parseFloat(bid) <= parseFloat(auction.current_bid)) {
      throw new Error('Bid must be higher than current bid');
    }
    auction.current_bid = parseFloat(bid);
    auction.highest_bidder_id = bidderId;
    return { rows: [auction] };
  }

  // 10. GET CONTESTS: select c.*, p.title...
  if (normText.includes('from public.contests c') && normText.includes('join public.products p')) {
    const list = mockDb.contests.map(c => {
      const p = mockDb.products.find(prod => prod.id === c.product_id);
      return {
        ...c,
        title: p ? p.title : '',
        description: p ? p.description : '',
        image_url: p ? p.image_url : '',
        category: p ? p.category : 'lego',
        market_value: p ? p.market_value : 0.0,
        condition: p ? p.condition : '',
        grading_info: p ? p.grading_info : ''
      };
    });
    return { rows: list };
  }

  // 11. ATOMIC BUY SLOT FUNCTION: select public.buy_contest_slot($1, $2, $3)
  if (normText.includes('select public.buy_contest_slot') || normText.includes('select * from public.buy_contest_slot')) {
    const [userId, contestId, slotCost] = params;
    const wallet = mockDb.user_wallets[userId];
    const contest = mockDb.contests.find(c => c.id === contestId);

    if (!wallet) {
      return { rows: [{ buy_contest_slot: { success: false, message: 'Wallet not found.' } }] };
    }
    if (!contest) {
      return { rows: [{ buy_contest_slot: { success: false, message: 'Contest not found.' } }] };
    }
    if (contest.status !== 'open') {
      return { rows: [{ buy_contest_slot: { success: false, message: 'Contest is no longer open.' } }] };
    }
    if (contest.filled_slots >= contest.total_slots) {
      return { rows: [{ buy_contest_slot: { success: false, message: 'Contest is full.' } }] };
    }
    const alreadyParticipating = mockDb.contest_participants.some(cp => cp.contest_id === contestId && cp.user_id === userId);
    if (alreadyParticipating) {
      return { rows: [{ buy_contest_slot: { success: false, message: 'User already participating.' } }] };
    }
    if (parseFloat(wallet.balance_credits) < parseFloat(slotCost)) {
      return { rows: [{ buy_contest_slot: { success: false, message: 'Insufficient balance.' } }] };
    }

    // Process Purchase
    wallet.balance_credits = parseFloat(wallet.balance_credits) - parseFloat(slotCost);
    
    // Log Transaction
    mockDb.credit_transactions.push({
      id: Math.random().toString(36).substring(2, 15),
      user_id: userId,
      amount: -parseFloat(slotCost),
      type: 'contest_entry',
      reference_id: contestId,
      created_at: new Date().toISOString()
    });

    // Add Participant
    const participant = {
      id: Math.random().toString(36).substring(2, 15),
      contest_id: contestId,
      user_id: userId,
      started_at: null,
      ended_at: null,
      total_time_ms: null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    mockDb.contest_participants.push(participant);

    // Update Contest
    contest.filled_slots += 1;
    if (contest.filled_slots >= contest.total_slots) {
      contest.status = 'active';
    }

    return {
      rows: [{
        buy_contest_slot: {
          success: true,
          message: 'Successfully bought contest slot.',
          new_balance: wallet.balance_credits,
          filled_slots: contest.filled_slots,
          contest_status: contest.status
        }
      }]
    };
  }

  // 12. GET CONTEST PARTICIPANTS LEADERBOARD
  if (normText.includes('select cp.*, pr.username from public.contest_participants cp')) {
    const contestId = params[0];
    const list = mockDb.contest_participants
      .filter(cp => cp.contest_id === contestId)
      .map(cp => {
        const user = mockDb.profiles.find(p => p.id === cp.user_id) || { username: 'Anonymous' };
        return {
          ...cp,
          username: user.username
        };
      })
      .sort((a, b) => {
        if (a.status !== 'completed') return 1;
        if (b.status !== 'completed') return -1;
        return a.total_time_ms - b.total_time_ms;
      });
    return { rows: list };
  }

  // 13. CONTEST PARTICIPANT: select * from public.contest_participants where contest_id =
  if (normText.includes('from public.contest_participants') && normText.includes('contest_id =') && normText.includes('user_id =') && !normText.startsWith('update')) {
    const [contestId, userId] = params;
    const cp = mockDb.contest_participants.find(c => c.contest_id === contestId && c.user_id === userId);
    return { rows: cp ? [cp] : [] };
  }

  // 14. UPDATE START CONTEST: update public.contest_participants set started_at =
  if (normText.startsWith('update public.contest_participants set started_at =')) {
    const [startedAt, contestId, userId] = params;
    const cp = mockDb.contest_participants.find(c => c.contest_id === contestId && c.user_id === userId);
    if (cp) {
      cp.started_at = startedAt;
    }
    return { rows: cp ? [cp] : [] };
  }

  // 15. UPDATE COMPLETE CONTEST: update public.contest_participants set ended_at =
  if (normText.startsWith('update public.contest_participants set ended_at =')) {
    const [endedAt, totalTimeMs, status, contestId, userId] = params;
    const cp = mockDb.contest_participants.find(c => c.contest_id === contestId && c.user_id === userId);
    if (cp) {
      cp.ended_at = endedAt;
      cp.total_time_ms = totalTimeMs;
      cp.status = status;
    }
    return { rows: cp ? [cp] : [] };
  }

  // 16. REFUND SYSTEM & CONTEST CANCELLATION
  // Find participants to refund
  if (normText.includes('select user_id from public.contest_participants where contest_id =')) {
    const contestId = params[0];
    const users = mockDb.contest_participants
      .filter(cp => cp.contest_id === contestId)
      .map(cp => ({ user_id: cp.user_id }));
    return { rows: users };
  }

  // Set contest status to cancelled / completed
  if (normText.startsWith('update public.contests set status =')) {
    const [status, contestId] = params;
    const contest = mockDb.contests.find(c => c.id === contestId);
    if (contest) {
      contest.status = status;
    }
    return { rows: contest ? [contest] : [] };
  }

  console.log('Unhandled mock query:', text);
  return { rows: [] };
};

module.exports = {
  query: (text, params) => {
    if (isMock) {
      return mockQuery(text, params);
    }
    return pool.query(text, params);
  },
  isMock,
  getMockDbState: () => mockDb // Exposed for verification & diagnostics
};
