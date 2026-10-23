// Options shared by the app's Postgres pools (src/db/index.js and src/db/clutchvault-db.js, both on Supabase).
// The defaults are node-postgres' own (10 connections, idle ones closed after 10 s, no limit on waiting for a free
// connection), so nothing changes unless the env vars below are set, e.g. when the Supabase plan's connection
// limit has to be shared between the two pools or between several instances:
//   PG_POOL_MAX              connections per pool                         (default 10)
//   PG_IDLE_TIMEOUT_MS       close a connection idle for this long        (default 10000)
//   PG_CONNECT_TIMEOUT_MS    give up waiting for a connection after this  (default 0 = wait)
const intFromEnv = (env, name, fallback) => {
  const n = Number.parseInt(env[name], 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function poolOptions(connectionString, env = process.env) {
  return {
    connectionString,
    ssl: { rejectUnauthorized: false }, // required by Supabase
    max: intFromEnv(env, 'PG_POOL_MAX', 10) || 10,
    idleTimeoutMillis: intFromEnv(env, 'PG_IDLE_TIMEOUT_MS', 10000),
    connectionTimeoutMillis: intFromEnv(env, 'PG_CONNECT_TIMEOUT_MS', 0),
  };
}

/**
 * Logs an error on an idle connection (e.g. Supabase closing it) instead of letting it crash the process: without
 * a listener, node-postgres re-emits it as an unhandled 'error' event. The pool drops that client by itself.
 */
function logIdleErrors(pool, label) {
  pool.on('error', (err) => console.error(`[db:${label}] idle connection error:`, err.message));
  return pool;
}

module.exports = { poolOptions, logIdleErrors };
