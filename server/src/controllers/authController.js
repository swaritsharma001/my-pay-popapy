const bcrypt = require('bcryptjs');
const Merchant = require('../models/Merchant');
const { generateMerchantCredentials } = require('../services/credentialService');
const { createAccessToken } = require('../services/tokenService');
const { signupSchema, loginSchema } = require('../validators/authSchemas');

function validationError(res, error) {
  return res.status(400).json({
    error: 'Validation failed',
    details: error.issues.map(({ path, message }) => ({ path, message })),
  });
}

function publicMerchant(merchant) {
  return {
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    upiId: merchant.upiId || null,
    gmail: {
      email: merchant.gmail?.email || null,
      connected: Boolean(merchant.gmail?.email),
    },
    publicKey: merchant.keys?.publicKey || null,
    webhookUrl: merchant.webhookUrl || null,
    createdAt: merchant.createdAt,
  };
}

async function signup(req, res, next) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const credentials = await generateMerchantCredentials();
    const merchant = new Merchant({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      keys: {
        publicKey: credentials.publicKey,
        secretKeyHash: credentials.secretKeyHash,
      },
      webhookSecret: credentials.webhookSecret,
    });

    await merchant.save();

    return res.status(201).json({
      merchant: publicMerchant(merchant),
      token: createAccessToken(merchant),
      credentials: {
        publicKey: credentials.publicKey,
        secretKey: credentials.secretKey,
        webhookSecret: credentials.webhookSecret,
      },
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const merchant = await Merchant.findOne({ email: parsed.data.email }).select(
      '+passwordHash',
    );
    if (!merchant || !(await bcrypt.compare(parsed.data.password, merchant.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({
      merchant: publicMerchant(merchant),
      token: createAccessToken(merchant),
    });
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const merchant = await Merchant.findById(req.merchantId);
    if (!merchant) return res.status(401).json({ error: 'Merchant account not found' });
    return res.json({ merchant: publicMerchant(merchant) });
  } catch (error) {
    return next(error);
  }
}

module.exports = { signup, login, getMe, publicMerchant, validationError };
