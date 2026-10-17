const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getMe } = require('../controllers/authController');

const router = express.Router();
router.use('/auth', require('./authRoutes'));
router.use('/merchant/gmail', require('./gmailRoutes'));
router.use('/merchant', require('./merchantRoutes'));
router.get('/me', requireAuth, getMe);
router.use('/orders', require('./orderRoutes'));
router.use('/checkout', require('./checkoutRoutes'));
router.use('/webhooks', require('./webhookRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/', require('./paymentRoutes'));
router.use('/dev', require('./devRoutes'));

module.exports = router;
