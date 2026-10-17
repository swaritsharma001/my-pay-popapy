const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function generateMerchantCredentials() {
  const publicKey = `pp_live_${crypto.randomBytes(18).toString('hex')}`;
  const secretKey = `pp_secret_${crypto.randomBytes(32).toString('hex')}`;
  const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const secretKeyHash = await bcrypt.hash(secretKey, 12);

  return {
    publicKey,
    secretKey,
    secretKeyHash,
    webhookSecret,
  };
}

module.exports = { generateMerchantCredentials };
