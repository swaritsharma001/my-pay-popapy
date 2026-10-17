const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { simulatePayment } = require('../controllers/devController');

const router = express.Router();
router.post('/simulate-payment', requireAuth, simulatePayment);

module.exports = router;
