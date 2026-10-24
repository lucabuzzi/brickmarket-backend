// Admin user management. Order matters: /users/detailed must stay above /users/:id.
const express = require('express');
const { adminAuth } = require('../../../middleware/auth');
const c = require('./users.controller');

const router = express.Router();

router.get('/users/detailed', adminAuth, c.crmList);
router.get('/users/:id/history', adminAuth, c.history);
router.get('/users', adminAuth, c.list);
router.get('/users/:id', adminAuth, c.profile);
router.get('/users/:id/documents', adminAuth, c.documents);
router.get('/documents/:filename', c.signedDocument); // signed link, no bearer token (see the controller)
router.get('/users/:id/activity', adminAuth, c.activity);
router.patch('/users/:id', adminAuth, c.update);

module.exports = router;
