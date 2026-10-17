const Merchant = require('../models/Merchant');
const { generateMerchantCredentials } = require('../services/credentialService');
const { validationError } = require('./authController');
const { upiBodySchema, webhookBodySchema } = require('../validators/merchantSchemas');

async function updateUpi(req, res, next) {
  const parsed = upiBodySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant account not found' });
    merchant.upiId = parsed.data.upiId;
    await merchant.save();
    return res.json({ upiId: merchant.upiId });
  } catch (error) {
    return next(error);
  }
}

async function regenerateKeys(req, res, next) {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant account not found' });

    const credentials = await generateMerchantCredentials();
    merchant.keys = {
      publicKey: credentials.publicKey,
      secretKeyHash: credentials.secretKeyHash,
    };
    merchant.webhookSecret = credentials.webhookSecret;
    await merchant.save();

    return res.json({
      message: 'Credentials replaced. Save these values; the secret key and webhook secret are shown only once.',
      credentials: {
        publicKey: credentials.publicKey,
        secretKey: credentials.secretKey,
        webhookSecret: credentials.webhookSecret,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateWebhook(req, res, next) {
  const parsed = webhookBodySchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) return res.status(404).json({ error: 'Merchant account not found' });
    merchant.webhookUrl = parsed.data.webhookUrl;
    await merchant.save();
    return res.json({ webhookUrl: merchant.webhookUrl });
  } catch (error) {
    return next(error);
  }
}

module.exports = { updateUpi, regenerateKeys, updateWebhook };
