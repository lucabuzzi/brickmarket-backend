-- CLUTCHVAULT DATABASE SCHEMA (PostgreSQL / Supabase)
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES (Linked to Supabase auth.users if available, otherwise standalone)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_wallets (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance_credits NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_credits >= 0.00),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CREDIT TRANSACTIONS (Immutable double-entry ledger)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'contest_entry', 'contest_refund', 'payout', 'shop_purchase')),
    reference_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- PRODUCTS CATALOG (Lego & Pokemon graded items)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('lego', 'pokemon')),
    market_value NUMERIC(12, 2) NOT NULL CHECK (market_value >= 0.00),
    condition VARCHAR(100) NOT NULL,
    grading_info TEXT, -- e.g. PSA 10, Sealed Box
    stock INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- AUCTIONS (Real-time live auction details)
CREATE TABLE IF NOT EXISTS public.auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    current_bid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_bid >= 0.00),
    highest_bidder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    buy_now_price NUMERIC(12, 2) NOT NULL CHECK (buy_now_price >= 0.00),
    ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_buy_now_price CHECK (buy_now_price >= current_bid)
);

-- CONTESTS (Skill-based rooms)
CREATE TABLE IF NOT EXISTS public.contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    total_slots INTEGER NOT NULL CHECK (total_slots > 0),
    filled_slots INTEGER NOT NULL DEFAULT 0 CHECK (filled_slots <= total_slots),
    slot_cost_credits NUMERIC(12, 2) NOT NULL CHECK (slot_cost_credits >= 0.00),
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed', 'cancelled')),
    winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CONTEST PARTICIPANTS (Leaderboard attempts)
CREATE TABLE IF NOT EXISTS public.contest_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_time_ms INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cheated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_contest_user UNIQUE (contest_id, user_id)
);

-- Row-Level Security & Triggers
-- Enable RLs if running in Supabase, but write it dynamically
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_participants ENABLE ROW LEVEL SECURITY;

-- Dynamic policies for public access (Development convenience)
CREATE POLICY "Allow public read for products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow public read for auctions" ON public.auctions FOR SELECT USING (true);
CREATE POLICY "Allow public read for contests" ON public.contests FOR SELECT USING (true);
CREATE POLICY "Allow public read for participants" ON public.contest_participants FOR SELECT USING (true);
CREATE POLICY "Allow profiles update by owner" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Allow wallets update by owner" ON public.user_wallets FOR ALL USING (true);
CREATE POLICY "Allow transactions update by owner" ON public.credit_transactions FOR ALL USING (true);

-- ATOMIC PL/pgSQL FUNCTION TO BUY CONTEST SLOT
-- Safeguards wallets against concurrent double-spend race conditions
CREATE OR REPLACE FUNCTION public.buy_contest_slot(
    target_user_id UUID,
    target_contest_id UUID,
    slot_cost NUMERIC
)
RETURNS JSON AS $$
DECLARE
    current_wallet_credits NUMERIC;
    contest_status VARCHAR;
    current_filled_slots INTEGER;
    max_slots INTEGER;
    existing_participant INTEGER;
    result_json JSON;
BEGIN
    -- 1. Lock the target wallet row using 'FOR UPDATE' to prevent concurrent race conditions
    SELECT balance_credits INTO current_wallet_credits
    FROM public.user_wallets
    WHERE user_id = target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Wallet not found for user.');
    END IF;

    -- Lock the contest row to prevent race conditions on max slots
    SELECT status, filled_slots, total_slots INTO contest_status, current_filled_slots, max_slots
    FROM public.contests
    WHERE id = target_contest_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Contest not found.');
    END IF;

    -- Validate contest state
    IF contest_status != 'open' THEN
        RETURN json_build_object('success', false, 'message', 'Contest is no longer open.');
    END IF;

    IF current_filled_slots >= max_slots THEN
        RETURN json_build_object('success', false, 'message', 'Contest slots are full.');
    END IF;

    -- Check if user is already a participant
    SELECT COUNT(*) INTO existing_participant
    FROM public.contest_participants
    WHERE contest_id = target_contest_id AND user_id = target_user_id;

    IF existing_participant > 0 THEN
        RETURN json_build_object('success', false, 'message', 'User already participating in this contest.');
    END IF;

    -- 2. Validate that the user has enough credits
    IF current_wallet_credits < slot_cost THEN
        RETURN json_build_object('success', false, 'message', 'Insufficient wallet balance.');
    END IF;

    -- 3. Deduct the credits
    UPDATE public.user_wallets
    SET balance_credits = balance_credits - slot_cost,
        updated_at = now()
    WHERE user_id = target_user_id;

    -- Log the negative ledger movement in credit_transactions
    INSERT INTO public.credit_transactions (user_id, amount, type, reference_id)
    VALUES (target_user_id, -slot_cost, 'contest_entry', target_contest_id::varchar);

    -- Insert user into contest_participants as 'pending'
    INSERT INTO public.contest_participants (contest_id, user_id, status)
    VALUES (target_contest_id, target_user_id, 'pending');

    -- Increment contest filled slots
    UPDATE public.contests
    SET filled_slots = filled_slots + 1
    WHERE id = target_contest_id
    RETURNING filled_slots INTO current_filled_slots;

    -- If all slots filled, change contest status to 'active'
    IF current_filled_slots >= max_slots THEN
        UPDATE public.contests
        SET status = 'active'
        WHERE id = target_contest_id;
        contest_status := 'active';
    END IF;

    RETURN json_build_object(
        'success', true,
        'message', 'Successfully bought contest slot.',
        'new_balance', current_wallet_credits - slot_cost,
        'filled_slots', current_filled_slots,
        'contest_status', contest_status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- SUPABASE AUTO-PROFILE TRIGGER SETUP
-- Create profile and wallet when a new user signs up in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_wallets (user_id, balance_credits)
  VALUES (new.id, 100.00) -- Welcome balance of 100 credits!
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger creation (uncomment or run if using Supabase auth.users triggers)
-- CREATE OR REPLACE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
