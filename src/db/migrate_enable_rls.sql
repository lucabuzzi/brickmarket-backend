-- ============================================================================
--  ENABLE ROW LEVEL SECURITY on the 9 tables flagged by the Security Advisor
--  (lint 0013 "rls_disabled_in_public", ERROR level)
--
--  DO NOT run this straight against production. Review, then apply manually
--  (Supabase SQL editor or psql) and immediately re-run the app smoke tests
--  listed at the bottom of this file.
--
--  Project: nrfyvnkoixmotmjdpnss (Brickmansion)
--  Prepared: 2026-09-10
-- ============================================================================
--
--  ARCHITECTURE FINDINGS (why the policies below are what they are)
--  ---------------------------------------------------------------------------
--  1. The Express backend connects through the Supavisor pooler as
--     `postgres.nrfyvnkoixmotmjdpnss`, which resolves to the `postgres` role.
--     `postgres` has rolbypassrls = true  ->  it IGNORES RLS entirely.
--     `service_role` (Supabase dashboard / MCP / edge) also has BYPASSRLS.
--     => Enabling RLS on these tables does NOT affect any backend query.
--
--  2. The React client does NOT talk to Supabase directly. `@supabase/supabase-js`
--     is listed in client/package.json but is never imported anywhere in
--     client/src; there is no VITE_SUPABASE_URL / anon key in the client env.
--     Every read/write goes through the Express API (JWT signed with the app's
--     own JWT_SECRET, verified only by Express).
--
--  3. Auth identity is `public.users` (custom table, custom JWT), NOT Supabase
--     Auth / GoTrue. Every FK on these tables points at `public.users`, never
--     `auth.users`. Therefore `auth.uid()` is always NULL for real app users
--     and owner-scoped RLS ("USING (auth.uid() = user_id)") cannot match any
--     legitimate request — it would only be theatre.
--
--  4. The rest of this database already runs this exact pattern: `listings`,
--     `orders`, `users`, `bids`, `reviews`, `notifications`, `watchlist`,
--     `addresses`, `profiles`, `analytics_*` ... all have RLS ENABLED with
--     ZERO policies, and the marketplace works in production. These 9 tables
--     were simply missed.
--
--  5. THE ACTUAL EXPOSURE this fixes: `anon` and `authenticated` currently hold
--     SELECT/INSERT/UPDATE/DELETE grants on all 9 tables (Supabase default
--     grants) and RLS is off. Anyone with the project's anon key (public, ships
--     in any Supabase frontend) can hit
--        https://<ref>.supabase.co/rest/v1/user_wallets
--     and read every wallet balance / the whole credit ledger, or write to
--     user_wallets / credit_transactions / featured_purchases directly.
--     Enabling RLS with no policy = deny-all for anon/authenticated (no
--     BYPASSRLS), backend unaffected.
--
--  CONCLUSION: the correct, non-breaking fix is Section A — enable RLS, add no
--  policies. Section D (pin function search_path) is safe hardening.
--  Sections B and C stay commented — not needed for the current architecture.
--
--  APPLIED to production 2026-09-10: Section A + Section D. Sections B and C NOT
--  applied.
-- ============================================================================


-- ---------------------------------------------------------------------------
--  SECTION A — the fix. Enable RLS, no policies (deny-all for anon/authenticated).
--  Safe: `postgres`/`service_role` bypass RLS, so every backend query is
--  unchanged. Mirrors listings/orders/users/bids/etc. which already do this.
--  NOT using FORCE ROW LEVEL SECURITY — nothing here runs as a non-bypass owner,
--  and FORCE would not change anything for BYPASSRLS roles anyway.
--
--  STATUS: APPLIED to production on 2026-09-10 (migration
--  "enable_rls_on_public_tables_section_a"). Verified after apply:
--    - advisor lint 0013 rls_disabled_in_public cleared for all 9 tables
--    - prod reads OK: /api/listings, /api/products, /api/auctions,
--      /api/contest/list, /api/contest/leaderboard/:id, /api/wallet/balance,
--      /api/wallet/transactions
--    - anon key via /rest/v1 now returns [] for user_wallets /
--      credit_transactions / products, and an anon PATCH of user_wallets
--      affects 0 rows (was: full read/write before).
--  Sections B/C/D below remain NOT applied.
-- ---------------------------------------------------------------------------

-- Wallet balance per user. Private financial data. Backend-only (walletRepository).
ALTER TABLE public.user_wallets          ENABLE ROW LEVEL SECURITY;

-- Credit ledger (deposits, contest entries, payouts, shop_purchase). Private
-- financial data. Backend-only (walletRepository, stripe webhook, buy_* funcs).
ALTER TABLE public.credit_transactions   ENABLE ROW LEVEL SECURITY;

-- Paid-promotion audit trail for "in evidenza". Private (who paid what).
-- Backend-only (src/services/featured.js).
ALTER TABLE public.featured_purchases    ENABLE ROW LEVEL SECURITY;

-- Puzzle-Arena contest slots. Rows tie a user to a contest + their run time.
-- Backend-only (src/routes/contest.js, buy_contest_slot()).
ALTER TABLE public.contest_participants  ENABLE ROW LEVEL SECURITY;

-- Admin-granted profile badges (user_id + who awarded it + private note).
-- Backend-only (src/routes/adminBadges.js).
ALTER TABLE public.user_badges           ENABLE ROW LEVEL SECURITY;

-- Badge catalogue (definitions). Not sensitive, but still only read/written by
-- the backend; no reason to expose the Data API surface.
ALTER TABLE public.badges                ENABLE ROW LEVEL SECURITY;

-- ClutchVault prize catalogue. Read/written by the backend only
-- (src/routes/contest.js, wallet buy_product()).
ALTER TABLE public.products              ENABLE ROW LEVEL SECURITY;

-- ClutchVault auctions (separate from marketplace `listings`). Backend-only
-- (inline routes in server.js: /api/auctions, /api/auctions/bid).
ALTER TABLE public.auctions              ENABLE ROW LEVEL SECURITY;

-- ClutchVault contests. Backend-only (src/routes/contest.js).
ALTER TABLE public.contests              ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
--  SECTION B (OPTIONAL) — defense in depth: drop the over-broad anon grants.
--  RLS already denies these roles, so this is belt-and-suspenders. It also
--  removes the tables from PostgREST's writable surface entirely.
--  Leave commented unless you specifically want it; it is safely reversible.
-- ---------------------------------------------------------------------------
-- REVOKE ALL ON public.user_wallets          FROM anon, authenticated;
-- REVOKE ALL ON public.credit_transactions   FROM anon, authenticated;
-- REVOKE ALL ON public.featured_purchases    FROM anon, authenticated;
-- REVOKE ALL ON public.contest_participants  FROM anon, authenticated;
-- REVOKE ALL ON public.user_badges           FROM anon, authenticated;
-- REVOKE ALL ON public.badges                FROM anon, authenticated;
-- REVOKE ALL ON public.products              FROM anon, authenticated;
-- REVOKE ALL ON public.auctions              FROM anon, authenticated;
-- REVOKE ALL ON public.contests              FROM anon, authenticated;


-- ---------------------------------------------------------------------------
--  SECTION C (OPTIONAL) — ONLY if you later decide to read some of this data
--  directly from a Supabase client (anon key) instead of via the Express API.
--  Today nothing does, so these are NOT needed and are left commented.
--
--  NOTE: owner-scoped policies (USING (auth.uid() = user_id)) are deliberately
--  NOT provided. This app does not use Supabase Auth, so auth.uid() is always
--  NULL for its users and such a policy could never match. If you migrate auth
--  to GoTrue in the future, revisit this.
--
--  "Public by nature" — read-only for everyone, writes stay backend-only
--  (no INSERT/UPDATE/DELETE policy => those are denied for anon/authenticated):
-- ---------------------------------------------------------------------------
-- CREATE POLICY products_public_read  ON public.products  FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY auctions_public_read  ON public.auctions  FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY contests_public_read  ON public.contests  FOR SELECT TO anon, authenticated USING (true);
-- CREATE POLICY badges_public_read    ON public.badges    FOR SELECT TO anon, authenticated USING (true);
--
--  Aggregate leaderboard for Puzzle Arena, if ever fetched client-side: expose
--  only finished runs, never 'pending'/'active' rows or other users' timing.
-- CREATE POLICY contest_participants_leaderboard_read
--   ON public.contest_participants FOR SELECT TO anon, authenticated
--   USING (status = 'completed');


-- ---------------------------------------------------------------------------
--  SECTION D — Security-Advisor lint 0011 (function_search_path_mutable, WARN):
--  the two wallet functions had no pinned search_path. Both are SECURITY
--  INVOKER and already use schema-qualified names, so pinning is
--  behaviour-neutral; it clears the lint and hardens against future edits.
--
--  STATUS: APPLIED to production on 2026-09-10 (migration
--  "pin_search_path_wallet_functions_section_d"). Verified: advisor lint 0011
--  cleared; public.buy_product(...) still returns a structured result
--  (dry-run with bogus ids -> {"success":false,"message":"Wallet not found ..."}).
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.buy_product(uuid, uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.buy_contest_slot(uuid, uuid, numeric, character varying)
  SET search_path = public, pg_temp;


-- ============================================================================
--  ROLLBACK (if a smoke test fails and you need to revert fast)
-- ============================================================================
-- ALTER TABLE public.user_wallets          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.credit_transactions   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.featured_purchases    DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.contest_participants  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_badges           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.badges                DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.products              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.auctions              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.contests              DISABLE ROW LEVEL SECURITY;
-- -- Section D:
-- ALTER FUNCTION public.buy_product(uuid, uuid)                                RESET search_path;
-- ALTER FUNCTION public.buy_contest_slot(uuid, uuid, numeric, character varying) RESET search_path;


-- ============================================================================
--  VERIFICATION (run after applying)
-- ============================================================================
-- 1) RLS now on for all 9, still 0 policies (expected — matches listings/orders):
-- SELECT c.relname, c.relrowsecurity,
--        (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('user_wallets','credit_transactions','auctions','products',
--                     'contests','contest_participants','user_badges','badges','featured_purchases')
-- ORDER BY c.relname;
--
-- 2) Advisor should drop lint 0013 (rls_disabled_in_public) for these 9.
--    They will now appear under lint 0008 (rls_enabled_no_policy, INFO) exactly
--    like listings/orders/users/etc. — that INFO is expected for a
--    service-role-only access model.
