
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
    ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  });

  mockDb.auctions.push({
    id: 'a1000000-0000-0000-0000-000000000002',
    product_id: p2.id,
    current_bid: 1200.00,
    highest_bidder_id: null,
    buy_now_price: 1600.00,
    ends_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
  
  // Verify tables exist
  pool.query("SELECT to_regclass('public.contests') AS exists").then(res => {
    if (!res.rows[0].exists) {
      console.warn("⚠️ ClutchVault tables not found in PostgreSQL. Falling back to In-Memory mock DB.");
      isMock = true;
      seedMockData();
    } else {
      console.log("✅ ClutchVault PostgreSQL tables found. Using database pool.");
    }
  }).catch(err => {
    console.warn("⚠️ Failed to verify ClutchVault tables. Falling back to In-Memory mock DB.", err.message);
    isMock = true;
    seedMockData();
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
      balance_credits: 100.00,
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

  // 11. ATOMIC BUY SLOT FUNCTION: select public.buy_contest_slot($1, $2, $3, $4)
  // Repeat entries by the same user are allowed (paid per play) until the contest's slots fill up.
  if (normText.includes('select public.buy_contest_slot') || normText.includes('select * from public.buy_contest_slot')) {
    const [userId, contestId, slotCost, username] = params;
    const wallet = mockDb.user_wallets[userId];
    const contest = mockDb.contests.find(c => c.id === contestId);

    if (!wallet) {
      return { rows: [{ result: { success: false, message: 'Wallet not found.' } }] };
    }
    if (!contest) {
      return { rows: [{ result: { success: false, message: 'Contest not found.' } }] };
    }
    if (contest.status !== 'open') {
      return { rows: [{ result: { success: false, message: 'Contest is no longer open.' } }] };
    }
    if (contest.filled_slots >= contest.total_slots) {
      return { rows: [{ result: { success: false, message: 'Contest is full.' } }] };
    }
    if (parseFloat(wallet.balance_credits) < parseFloat(slotCost)) {
      return { rows: [{ result: { success: false, message: 'Insufficient balance.' } }] };
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

    // Add Participant (one row per paid attempt — the same user can appear multiple times)
    const participant = {
      id: Math.random().toString(36).substring(2, 15),
      contest_id: contestId,
      user_id: userId,
      username: username || 'Player',
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
        result: {
          success: true,
          message: 'Successfully bought contest slot.',
          new_balance: wallet.balance_credits,
          filled_slots: contest.filled_slots,
          contest_status: contest.status
        }
      }]
    };
  }

  // 12. GET CONTEST PARTICIPANTS LEADERBOARD (username is stored directly on the participant row)
  if (normText.includes('select cp.* from public.contest_participants cp')) {
    const contestId = params[0];
    const list = mockDb.contest_participants
      .filter(cp => cp.contest_id === contestId)
      .slice()
      .sort((a, b) => {
        if (a.status !== 'completed') return 1;
        if (b.status !== 'completed') return -1;
        return a.total_time_ms - b.total_time_ms;
      });
    return { rows: list };
  }

  // 12b. WINNER LOOKUP (fastest completed attempt): select cp.user_id, cp.total_time_ms, cp.username ...
  if (normText.startsWith('select cp.user_id, cp.total_time_ms, cp.username')) {
    const contestId = params[0];
    const completed = mockDb.contest_participants
      .filter(cp => cp.contest_id === contestId && cp.status === 'completed')
      .slice()
      .sort((a, b) => a.total_time_ms - b.total_time_ms);
    return { rows: completed.length > 0 ? [completed[0]] : [] };
  }

  // 12c. COUNT NON-PENDING PARTICIPANTS (used to check if a contest is ready to finalize)
  if (normText.startsWith('select count(*) as count from public.contest_participants')) {
    const contestId = params[0];
    const count = mockDb.contest_participants.filter(cp => cp.contest_id === contestId && cp.status !== 'pending').length;
    return { rows: [{ count }] };
  }

  // 13. FIND THE MOST RECENT UN-STARTED ATTEMPT for this user in this contest (used by /start)
  if (normText.includes('from public.contest_participants') && normText.includes('contest_id =') && normText.includes('user_id =') && !normText.startsWith('update')) {
    const [contestId, userId] = params;
    let matches = mockDb.contest_participants.filter(c => c.contest_id === contestId && c.user_id === userId);
    if (normText.includes('started_at is null')) {
      matches = matches.filter(c => !c.started_at);
    }
    matches = matches.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: matches.length > 0 ? [matches[0]] : [] };
  }

  // 14. UPDATE START CONTEST: update public.contest_participants set started_at = $1 where id = $2
  if (normText.startsWith('update public.contest_participants set started_at =')) {
    const [startedAt, participantId] = params;
    const cp = mockDb.contest_participants.find(c => c.id === participantId);
    if (cp) {
      cp.started_at = startedAt;
    }
    return { rows: cp ? [cp] : [] };
  }

  // 15. UPDATE COMPLETE CONTEST: update public.contest_participants set ended_at = ... where id = $4
  if (normText.startsWith('update public.contest_participants set ended_at =')) {
    const [endedAt, totalTimeMs, status, participantId] = params;
    const cp = mockDb.contest_participants.find(c => c.id === participantId);
    if (cp) {
      cp.ended_at = endedAt;
      cp.total_time_ms = totalTimeMs;
      cp.status = status;
    }
    return { rows: cp ? [cp] : [] };
  }

  // 15b. ANTI-CHEAT VOID: update public.contest_participants set status = 'cheated' where ... (only the in-flight attempt)
  if (normText.startsWith("update public.contest_participants set status = 'cheated'")) {
    const [contestId, userId] = params;
    const matches = mockDb.contest_participants.filter(c =>
      c.contest_id === contestId && c.user_id === userId && c.started_at && !c.ended_at
    );
    matches.forEach(cp => { cp.status = 'cheated'; });
    return { rows: matches };
  }

  // 16. REFUND SYSTEM & CONTEST CANCELLATION (excludes the winner when a userId to exclude is passed)
  if (normText.includes('select user_id from public.contest_participants where contest_id =')) {
    const [contestId, excludeUserId] = params;
    const users = mockDb.contest_participants
      .filter(cp => cp.contest_id === contestId && cp.user_id !== excludeUserId)
      .map(cp => ({ user_id: cp.user_id }));
    return { rows: users };
  }

  if (normText.startsWith('update public.contests set status =')) {
    const [status, contestId] = params;
    const contest = mockDb.contests.find(c => c.id === contestId);
    if (contest) {
      contest.status = status;
    }
    return { rows: contest ? [contest] : [] };
  }

  // 17. INSERT INTO public.products (Mock DB)
  if (normText.startsWith('insert into public.products')) {
    const [id, title, description, imageUrl, category, marketValue, condition, gradingInfo] = params;
    const newProduct = {
      id,
      title,
      description: description || '',
      image_url: imageUrl,
      category,
      market_value: parseFloat(marketValue),
      condition: condition || 'New',
      grading_info: gradingInfo || 'Ungraded',
      stock: 1
    };
    mockDb.products.push(newProduct);
    return { rows: [newProduct] };
  }

  // 18. INSERT INTO public.contests (Mock DB)
  if (normText.startsWith('insert into public.contests')) {
    const [id, productId, totalSlots, slotCostCredits] = params;
    const newContest = {
      id,
      product_id: productId,
      total_slots: parseInt(totalSlots, 10),
      filled_slots: 0,
      slot_cost_credits: parseFloat(slotCostCredits),
      status: 'open',
      winner_id: null
    };
    mockDb.contests.push(newContest);
    return { rows: [newContest] };
  }

  // 19. SELECT FROM public.contests WHERE id = (Mock DB)
  if (normText.includes('from public.contests') && normText.includes('id =') && !normText.includes('join')) {
    const contestId = params[0];
    const contest = mockDb.contests.find(c => c.id === contestId);
    return { rows: contest ? [contest] : [] };
  }

  console.log('Unhandled mock query:', text);
  return { rows: [] };
};

const query = async (text, params) => {
  if (isMock) {
    return await mockQuery(text, params);
  }
  return await pool.query(text, params);
};

module.exports = {
  query,
  get isMock() { return isMock; },
  getMockDbState: () => mockDb
};
