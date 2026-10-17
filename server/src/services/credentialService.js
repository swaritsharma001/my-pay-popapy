const crypto = require('crypto');

async function generateMerchantCredentials() {
  const publicKey = `pp_live_${crypto.randomBytes(18).toString('hex')}`;
  const secretKey = `pp_secret_${crypto.randomBytes(32).toString('hex')}`;
  const signingSecret = `pp_sign_${crypto.randomBytes(32).toString('hex')}`;
  const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  // API keys have high entropy, so a SHA-256 digest supports indexed lookup.
  const secretKeyHash = crypto.createHash('sha256').update(secretKey).digest('hex');

  return {
    publicKey,
    secretKey,
    secretKeyHash,
    signingSecret,
    webhookSecret,
  };
}

module.exports = { generateMerchantCredentials };
