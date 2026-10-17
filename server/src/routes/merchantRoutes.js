const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  updateUpi,
  regenerateKeys,
  updateWebhook,
} = require('../controllers/merchantController');

const router = express.Router();

router.use(requireAuth);
router.put('/upi', updateUpi);
router.post('/keys/regenerate', regenerateKeys);
router.put('/webhook', updateWebhook);

module.exports = router;
