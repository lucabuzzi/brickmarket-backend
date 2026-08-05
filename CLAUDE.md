# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

BrickMarket is a two-part app in one repo:
- **Root** (`/`): Node/Express + PostgreSQL (Supabase) backend, `server.js` entry point, listens on port 3000.
- **`client/`**: React 19 + Vite 8 + Tailwind v4 frontend, dev server on port 5173, proxies `/api`, `/uploads`, `/health` to the backend (see `client/vite.config.js`).

A second, mostly-separate product called **ClutchVault** (a credit-wallet contest/prize app) also lives in this repo — see "ClutchVault" below before touching wallet/contest/stripe code.

## Commands

Run from the repo root unless noted.

```bash
npm start                    # backend: nodemon server.js (port 3000)
npm run client                # runs `npm run dev` inside client/ (shortcut)
npm run seed                  # node scripts/seed-dummy-data.js
```

From `client/`:
```bash
npm run dev                   # Vite dev server, port 5173
npm run build                 # production build
npm run lint                  # eslint .
npm run preview               # preview a production build
```

There is no test suite: the root `npm test` is an unimplemented stub and `client/package.json` has no test script. Don't invent test commands.

Database migrations are ad-hoc, not framework-managed: `src/db/*.sql` and `src/db/migrate_*.js` are one-off scripts run manually with `node src/db/migrate_x.js` or against Supabase directly — there's no migration runner to invoke.

## Backend architecture (`/src`)

- **`server.js`** wires everything: Express app + a raw `http` server + a `ws` WebSocket server used as a "Live Hub" broadcast channel (`app.get('broadcast')`, emits events like `BID_PLACED`, `CONTEST_CREATED`). The Stripe webhook route(s) are mounted with `express.raw()` *before* the global `express.json()` middleware — keep any new webhook routes above that line. CSP is intentionally permissive for the dev flow (see the hardcoded header) — don't tighten it without checking why it was relaxed.
- **`src/routes/*.js`** — one file per domain (`auth`, `listings`, `users`, `payments`, `shipping`, `orders`, `notifications`, `sets`, `reviews`, `admin`, `catalog`, plus ClutchVault's `contest`, `wallet`, `stripe`). Mounted directly in `server.js` under `/api/<name>`.
- **`src/db/index.js`** — the main marketplace DB: a `pg` `Pool` against `DATABASE_URL` (Supabase Postgres), exporting `query`/`getClient`. `src/db/clutchvault-db.js` is a *second*, separate connection module for ClutchVault (see below).
- **`src/middleware/auth.js`** exports two guards: default export `auth` (JWT verify only) and `adminAuth` (JWT verify + a DB round-trip re-checking `role`/`is_active`, to stop stale-token privilege escalation). Use `adminAuth` for admin routes, not plain `auth` + a manual role check.
- **`src/services/`** — external integrations: `cloudinary.js`/`image.js` (uploads, via `sharp`), `email.js` (nodemailer/SendGrid), `marketValue.js` (pricing logic), `rebrickable.js` (LEGO set catalog lookups), `shipping.js`, `gemini.js`. `paypal.js` and `stripe.js` in this folder are empty stubs — real Stripe logic lives in `src/routes/payments.js` and `src/routes/stripe.js` instead; don't be misled by the empty files.

## ClutchVault

ClutchVault (credit wallet + prize contests/jigsaw puzzles) exists in **two places** — know which one you're editing:
1. A fully standalone app under `clutchvault/` (own `backend/` Express server, own `frontend/` Vite+React app, own `package.json`/`node_modules`, own `schema.sql`). Not started by any root/client script.
2. A parallel integration merged directly into the main backend: `src/routes/contest.js`, `src/routes/wallet.js`, `src/routes/stripe.js`, mounted in `server.js` alongside a few inline routes (`/api/products`, `/api/auctions`, `/api/auctions/bid`) that also live in `server.js` itself rather than a route file.

The merged integration talks to `src/db/clutchvault-db.js`, which auto-falls-back to an **in-memory mock** (`isMock` flag, `getMockDbState()`) whenever it can't reach Postgres — contest/wallet endpoints keep responding without a real DB in that mode. If wallet/contest behavior looks wrong, check `isMock` first before assuming a DB bug.

The frontend's `AuthContext` (`client/src/auth/AuthContext.jsx`) fetches wallet balance (`/api/wallet/balance`) as part of normal login/session refresh, so ClutchVault's credit balance is threaded through the main app's auth state even outside ClutchVault's own UI.

## Frontend architecture (`client/src`)

- **`App.jsx`** is the single route table (react-router-dom v7), wrapped in `Layout`; protected routes use `<ProtectedRoute>` / `<ProtectedRoute adminOnly>`.
- **`api.js`** centralizes backend access: `API_BASE`/`apiUrl()`, `apiFetch`/`apiPostForm` (attach the JWT from `localStorage` under `TOKEN_STORAGE_KEY = 'brickmarket_token'`, throw on non-2xx with `.status`/`.data` attached), and `normalizeImageUrl()` for resolving local `/uploads/...` paths vs absolute URLs. Use these helpers for any new API call rather than raw `fetch`.
- **`auth/AuthContext.jsx`** — global `user` + ClutchVault `wallet` state, exposes `login`/`register`/`logout`/`refreshMe`/`refreshWallet` via `useAuth()`.
- **`components/StitchComponents.jsx`** — the shared UI primitive kit (`StitchCard` glassmorphism cards, `AnimateCounter`, etc.) built on `framer-motion` + a `cn()` helper (`clsx` + `tailwind-merge`). Reuse these instead of building new one-off animated cards.
- **i18n**: `i18n.js` + `locales/{en,it,es,fr,de}.json` via `i18next`/`react-i18next` with browser language auto-detection — add new UI strings to all five locale files, not just `en`.
- Styling is Tailwind v4 via the `@tailwindcss/vite` plugin (no separate `tailwind.config.js` needed in `client/`).

## Working conventions (from `.agents/agents.md`)

This repo has lightweight, informal "agent role" docs (Italian) that predate this file — the essence carries over:
- Keep new UI mobile-first, Tailwind-only, visually consistent with the existing "Bento Premium" glassmorphism aesthetic (see `StitchComponents.jsx`).
- When backend API shapes change, double check every `client/src` call site that hits that endpoint for matching params/response shape.
- If the DB looks empty during manual testing, `scripts/seed-dummy-data.js` (via `npm run seed`) is the way to populate it — auctions (active + expired) and a sold listing are the cases worth having present.

### Mobile responsiveness rule

Every page/component must render correctly at phone widths (~375–430px, e.g. iPhone SE/12/14), not just shrink without breaking:
- Never put two or more `<select>`/dropdown filters (or any text-bearing controls) side by side with `flex-1`/`flex-auto` below the `sm` (640px) breakpoint — narrow flex siblings truncate their label text unreadably. Stack them full-width (`grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-nowrap`) and only let them sit inline once there's room (`sm:`/`md:` and up). See `Annunci.jsx`/`Aste.jsx` filter bars for the reference pattern.
- Reduce paddings, font sizes, and image aspect ratios on mobile rather than letting desktop sizing bleed down (`p-6 md:p-8`, `text-3xl md:text-4xl` style scales are already used across hero banners — keep following that pattern for new sections).
- Verify with a real narrow viewport, not just "does it not overflow": OS-level window resize / Chrome's device toolbar is not reliable to drive through the claude-in-chrome automation tools in this environment — instead inject a fixed-size (~390×844) `<iframe>` pointing at the target route into a scratch tab via `javascript_tool` and screenshot that, which gives a genuine narrow layout viewport for the page's media queries.
- After any change, confirm there's no horizontal scroll (`document.documentElement.scrollWidth <= clientWidth`) at the test width before calling it done.
