// /api/admin — one router per admin area. Each area guards its own routes with adminAuth (route by route,
// never router.use(adminAuth): an unknown /api/admin path must still fall through to the next routers mounted
// on /api/admin — adminBadges, adminGameChat — and finally 404). No path is served by two areas, so the order
// below only matters within each area's own file.
const express = require('express');

const router = express.Router();

router.use(require('./analytics/analytics.routes'));
router.use(require('./users/users.routes'));
router.use(require('./credits/credits.routes'));
router.use(require('./orders/orders.routes'));
router.use(require('./listings/listings.routes'));

module.exports = router;
