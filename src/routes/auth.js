const express = require('express');
const auth = require('../middleware/auth');
const authRateLimit = require('../middleware/authRateLimit');
const { upload, secureUpload } = require('../services/cloudinary');
const authController = require('../controllers/authController');
const router = express.Router();

router.post(
  '/register',
  authRateLimit,
  secureUpload.fields([{ name: 'id_scan', maxCount: 1 }, { name: 'business_license', maxCount: 1 }]),
  authController.registerHandler
);

router.post('/login', authRateLimit, authController.loginHandler);

router.post('/google', authRateLimit, authController.googleAuthHandler);
router.post('/apple', authRateLimit, authController.appleAuthHandler);

router.get('/me', auth, authController.meHandler);
router.patch('/me', auth, upload.single('avatar'), authController.updateMeHandler);

router.post('/forgot-password', authRateLimit, authController.forgotPasswordHandler);
router.post('/reset-password', authRateLimit, authController.resetPasswordHandler);

module.exports = router;
