// Admin dashboard: platform totals and site analytics.
const express = require('express');
const { adminAuth } = require('../../../middleware/auth');
const c = require('./analytics.controller');

const router = express.Router();

router.get('/stats', adminAuth, c.stats);
router.get('/analytics/interactions', adminAuth, c.interactions);
router.get('/analytics/overview', adminAuth, c.overview);
router.get('/analytics/sessions', adminAuth, c.sessions);
router.get('/analytics/behavior', adminAuth, c.behavior);
// Historical calendar: per-day snapshots (?year=&month=), one day's detail (?date=), manual backfill.
router.get('/analytics/calendar', adminAuth, c.calendar);
router.get('/analytics/day', adminAuth, c.day);
router.post('/analytics/snapshot/backfill', adminAuth, c.backfill);

module.exports = router;
