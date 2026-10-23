const HttpError = require('./HttpError');

/**
 * Wraps an async controller so its errors become answers:
 *  - HttpError                -> its status and `{ error: message }`;
 *  - anything else, fallback  -> logs `fallback.log` (when set) and answers 500 `{ error: fallback.error }`;
 *  - anything else, no fallback -> rethrown: an unhandled rejection, exactly what an un-wrapped async handler
 *    gives under Express 4. Only used where a route had no catch-all before; see the callers.
 *
 * @param {(req, res, next) => Promise<void>} fn
 * @param {{ log?: string, error: string } | null} fallback
 */
function handle(fn, fallback) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json(err.body);
      if (!fallback) throw err;
      if (fallback.log) console.error(fallback.log, err.message);
      res.status(500).json({ error: fallback.error });
    }
  };
}

module.exports = handle;
