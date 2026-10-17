const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { signupSchema, loginSchema } = require('../src/validators/authSchemas');
const {
  upiIdSchema,
  webhookUrlSchema,
} = require('../src/validators/merchantSchemas');
const { generateMerchantCredentials } = require('../src/services/credentialService');
const app = require('../src/app');

test('signup and login validate and normalize email addresses', () => {
  const signup = signupSchema.parse({
    name: '  PopPay Shop ',
    email: ' Owner@Example.com ',
    password: 'correct-horse-battery',
  });
  assert.equal(signup.name, 'PopPay Shop');
  assert.equal(signup.email, 'owner@example.com');
  assert.equal(loginSchema.safeParse({ email: 'bad', password: '' }).success, false);
});

test('UPI IDs accept expected handles and reject malformed values', () => {
  assert.equal(upiIdSchema.safeParse('shop.name@okaxis').success, true);
  assert.equal(upiIdSchema.safeParse('not-a-upi-id').success, false);
});

test('webhook URLs require HTTPS', () => {
  assert.equal(webhookUrlSchema.safeParse('https://merchant.example/hook').success, true);
  assert.equal(webhookUrlSchema.safeParse('http://merchant.example/hook').success, false);
  assert.equal(webhookUrlSchema.safeParse('https://user:pass@merchant.example/hook').success, false);
});

test('generated credentials have PopPay prefixes and only a bcrypt hash is stored', async () => {
  const credentials = await generateMerchantCredentials();
  assert.match(credentials.publicKey, /^pp_live_[a-f0-9]{36}$/);
  assert.match(credentials.secretKey, /^pp_secret_[a-f0-9]{64}$/);
  assert.match(credentials.webhookSecret, /^whsec_[a-f0-9]{64}$/);
  assert.notEqual(credentials.secretKeyHash, credentials.secretKey);
  assert.equal(await bcrypt.compare(credentials.secretKey, credentials.secretKeyHash), true);
});

test('auth and merchant routes enforce validation and bearer authentication', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
    const signup = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(signup.status, 400);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invalid', password: '' }),
    });
    assert.equal(login.status, 400);

    const profile = await fetch(`${baseUrl}/me`);
    assert.equal(profile.status, 401);

    for (const [path, method, body] of [
      ['/merchant/upi', 'PUT', { upiId: 'shop@bank' }],
      ['/merchant/keys/regenerate', 'POST', undefined],
      ['/merchant/webhook', 'PUT', { webhookUrl: 'https://merchant.example/hook' }],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.equal(response.status, 401, `${method} ${path} should require a JWT`);
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
