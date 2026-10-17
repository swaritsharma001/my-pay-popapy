const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  listWebhookLogs,
  retryWebhook,
} = require('../controllers/webhookController');

const router = express.Router();
router.use(requireAuth);
router.get('/logs', listWebhookLogs);
router.post('/:id/retry', retryWebhook);

module.exports = router;
