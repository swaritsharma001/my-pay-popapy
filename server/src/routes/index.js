const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getMe } = require('../controllers/authController');

const router = express.Router();
router.use('/auth', require('./authRoutes'));
router.use('/merchant', require('./merchantRoutes'));
router.get('/me', requireAuth, getMe);

module.exports = router;
