const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const {
  connect,
  callback,
  disconnect,
  updateAllowedSenders,
} = require('../controllers/gmailController');

const router = express.Router();
router.get('/connect', requireAuth, connect);
router.get('/callback', callback);
router.post('/disconnect', requireAuth, disconnect);
router.put('/allowed-senders', requireAuth, updateAllowedSenders);

module.exports = router;
