/**
 * An error that already knows its HTTP answer. Services throw it for every outcome the client should see
 * (validation, not found, forbidden, a 500 with a specific message); `handle()` turns it into
 * `res.status(status).json({ error: message })`. Anything else thrown is an unexpected failure.
 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }

  get body() {
    return { error: this.message };
  }
}

module.exports = HttpError;
