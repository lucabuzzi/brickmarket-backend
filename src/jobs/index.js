// The background jobs of the backend, with their schedules. Started by server.js once it listens.
const { backfillSnapshots } = require('../services/analyticsSnapshot');
const { expireFeaturedListings } = require('../services/featured');
const { processMaturedGrants } = require('../services/creditMaturation');
const { processAutoConfirmations } = require('../services/orderAutoConfirm');

// Analytics daily snapshots are archived from this day onward.
const ANALYTICS_ARCHIVE_START = '2026-07-01';

const JOBS = [
  {
    // Backfills every day since the archive start that has no snapshot yet (covers days the server was down at
    // midnight), then saves yesterday's every night.
    name: 'Analytics',
    cron: '10 0 * * *',
    label: 'Daily snapshot job',
    atBoot: true,
    run: () => backfillSnapshots(ANALYTICS_ARCHIVE_START),
    describe: (results) => `${results.length} day(s) computed since ${ANALYTICS_ARCHIVE_START}.`,
  },
  {
    // Backstop for lapsed "in evidenza" windows: the public feed already lazy-expires them on every
    // GET /api/listings, this catches listings nobody views while they are still flagged is_featured.
    name: 'Featured',
    cron: '5 * * * *',
    label: 'Hourly expiry job',
    atBoot: false,
    run: () => expireFeaturedListings(), // logs nothing when it succeeds
  },
  {
    // Credit bonus maturation (sale/purchase bonus, 15-day "periodo di maturazione", see CLAUDE.md).
    name: 'CreditMaturation',
    cron: '20 0 * * *',
    label: 'Daily job',
    atBoot: true,
    run: () => processMaturedGrants(),
    describe: ({ matured, cancelled, deferred, total }) => `${matured} matured, ${cancelled} cancelled, ${deferred} deferred (disputed), ${total} due.`,
  },
  {
    // Confirms delivery when the buyer never does within orders.confirm_deadline (5 days from the order), with the
    // same transaction/effects as the manual "confirm delivery" button (see paymentsRepository.js).
    name: 'AutoConfirm',
    cron: '15 * * * *',
    label: 'Hourly job',
    atBoot: true,
    run: () => processAutoConfirmations(),
    describe: ({ confirmed, total }) => `${confirmed}/${total} order(s) auto-confirmed.`,
  },
];

module.exports = { JOBS, ANALYTICS_ARCHIVE_START };
