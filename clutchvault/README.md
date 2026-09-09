# ClutchVault (standalone) — DEPRECATED

This standalone app (own Express `backend/`, own Vite+React `frontend/`, own
`schema.sql`) is **not in active use**. It isn't started by any script in the
repo root or `client/`, and isn't referenced by any deploy configuration
(`Procfile`, `render.yaml`, `vercel.json`, `railway.json`, `.github/workflows`
— none exist here or elsewhere in the repo).

ClutchVault (credit wallet + prize contests/jigsaw puzzles) is live as a
parallel integration merged directly into the main backend instead:
`src/routes/contest.js`, `src/routes/wallet.js`, `src/routes/stripe.js`,
mounted in the root `server.js`. See the "ClutchVault" section in the root
`CLAUDE.md` for details.

This directory is kept for reference only. Do not build new features here —
make ClutchVault changes in the merged integration above.
