const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  stats,
  listDashboardOrders,
} = require('../controllers/dashboardController');

const router = express.Router();
router.use(requireAuth);
router.get('/stats', stats);
router.get('/orders', listDashboardOrders);

module.exports = router;
