const crypto = require('crypto');
const Merchant = require('../models/Merchant');

async function requireSecretKey(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(pp_secret_[A-Za-z0-9_-]+)$/);
  if (!match) return res.status(401).json({ error: 'Secret key authentication required' });

  try {
    const secretKeyHash = crypto
      .createHash('sha256')
      .update(match[1])
      .digest('hex');
    const merchant = await Merchant.findOne({
      'keys.secretKeyHash': secretKeyHash,
    }).select('+keys.secretKeyHash');
    if (!merchant) return res.status(401).json({ error: 'Invalid secret key' });

    req.merchantId = merchant.id;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireSecretKey;
