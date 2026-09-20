// The one place test code is allowed to load environment variables from —
// .env.test, never .env. Every test helper that needs env vars (DATABASE_URL,
// JWT_SECRET, ...) requires this file first, instead of calling
// require('dotenv').config() itself.
//
// .env.test does not exist yet in this repo (see the "DB DI TEST" setup
// steps for creating the separate Supabase project it should point at).
// Until it does, DATABASE_URL stays unset here, and
// tests/helpers/guardAgainstProduction.js refuses to let tests run — which
// is the intended, safe default, not a bug.
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.test') });
