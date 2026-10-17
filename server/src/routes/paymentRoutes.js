const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  listPayments,
  listUnmatched,
  claimUnmatched,
} = require('../controllers/dashboardController');

const router = express.Router();
router.use(requireAuth);
router.get('/payments', listPayments);
router.get('/unmatched', listUnmatched);
router.post('/unmatched/:id/claim', claimUnmatched);

module.exports = router;
