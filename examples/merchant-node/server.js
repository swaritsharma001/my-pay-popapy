require('dotenv').config();

const crypto = require('crypto');
const express = require('express');

const requiredEnv = [
  'POPPAY_BASE_URL',
  'POPPAY_PUBLIC_KEY',
  'POPPAY_SECRET_KEY',
  'POPPAY_SIGNING_SECRET',
  'POPPAY_WEBHOOK_SECRET',
];
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const app = express();
app.use(
  express.json({
    limit: '64kb',
    verify(req, res, buffer) {
      req.rawBody = Buffer.from(buffer);
    },
  }),
);
app.use(express.static('public'));
app.get('/config.js', (req, res) => {
  const baseUrl = process.env.POPPAY_BASE_URL.replace(/\/$/, '');
  res.type('application/javascript').send(
    `window.POPPAY_PUBLIC_KEY=${JSON.stringify(process.env.POPPAY_PUBLIC_KEY)};window.POPPAY_BASE_URL=${JSON.stringify(baseUrl)};`,
  );
});

app.post('/create-order', async (req, res) => {
  try {
    const response = await fetch(`${process.env.POPPAY_BASE_URL.replace(/\/$/, '')}/api/v1/orders`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.POPPAY_SECRET_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: '499.00',
        receipt: `example-${Date.now()}`,
        ...(process.env.MERCHANT_REDIRECT_URL
          ? { redirectUrl: process.env.MERCHANT_REDIRECT_URL }
          : {}),
      }),
    });
    const payload = await response.json();
    return res.status(response.status).json(payload);
  } catch {
    return res.status(502).json({ error: 'PopPay could not be reached.' });
  }
});

app.post('/verify-payment', (req, res) => {
  const { order_id: orderId, payment_id: paymentId, signature } = req.body || {};
  if (![orderId, paymentId, signature].every((value) => typeof value === 'string')) {
    return res.status(400).json({ verified: false });
  }
  const expected = crypto
    .createHmac('sha256', process.env.POPPAY_SIGNING_SECRET)
    .update(`${orderId}|${paymentId}`, 'utf8')
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'hex');
  } catch {
    return res.status(400).json({ verified: false });
  }
  const verified = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  return res.status(verified ? 200 : 400).json({ verified });
});

app.post('/webhook', (req, res) => {
  const signature = req.get('X-PopPay-Signature') || '';
  const expected = crypto
    .createHmac('sha256', process.env.POPPAY_WEBHOOK_SECRET)
    .update(req.rawBody || Buffer.alloc(0))
    .digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'hex');
  } catch {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
  return res.json({ received: true, event: req.body?.event || null });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Merchant example listening on port ${port}`);
});
