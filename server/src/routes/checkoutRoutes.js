const express = require('express');
const {
  publicCheckout,
  checkoutStatus,
} = require('../controllers/orderController');

const router = express.Router();
router.get('/:orderId', publicCheckout);
router.get('/:orderId/status', checkoutStatus);

module.exports = router;
