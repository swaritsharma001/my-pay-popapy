const express = require('express');
const requireSecretKey = require('../middleware/requireSecretKey');
const {
  createOrder,
  getOrder,
  listOrders,
} = require('../controllers/orderController');

const router = express.Router();
router.use(requireSecretKey);
router.post('/', createOrder);
router.get('/', listOrders);
router.get('/:id', getOrder);

module.exports = router;
