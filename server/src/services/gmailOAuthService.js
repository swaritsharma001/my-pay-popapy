const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const Merchant = require('../models/Merchant');
const { getRequiredEnv } = require('../config');
const { decryptText, encryptText } = require('../utils/encryption');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const STATE_ISSUER = 'poppay-gmail-oauth';

function createOAuthClient() {
  return new google.auth.OAuth2(
    getRequiredEnv('GMAIL_CLIENT_ID'),
    getRequiredEnv('GMAIL_CLIENT_SECRET'),
    getRequiredEnv('GMAIL_REDIRECT_URI'),
  );
}

function createConnectUrl(merchantId) {
  const state = jwt.sign(
    { merchantId, nonce: crypto.randomUUID() },
    getRequiredEnv('JWT_SECRET'),
    { algorithm: 'HS256', expiresIn: '10m', issuer: STATE_ISSUER },
  );
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_SCOPE],
    state,
  });
}

async function completeOAuth(code, state) {
  const claims = jwt.verify(state, getRequiredEnv('JWT_SECRET'), {
    algorithms: ['HS256'],
    issuer: STATE_ISSUER,
  });
  if (!claims.merchantId || !claims.nonce) {
    throw new Error('Invalid Gmail OAuth state');
  }

  const oauth = createOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token; reconnect and grant consent');
  }
  oauth.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: oauth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  if (!profile.data.emailAddress || !profile.data.historyId) {
    throw new Error('Google returned an incomplete Gmail profile');
  }

  const merchant = await Merchant.findById(claims.merchantId).select(
    '+gmail.encryptedRefreshToken',
  );
  if (!merchant) throw new Error('Merchant account not found');
  merchant.gmail = {
    email: profile.data.emailAddress.toLowerCase(),
    encryptedRefreshToken: encryptText(tokens.refresh_token),
    historyId: profile.data.historyId,
  };
  await merchant.save();
  return merchant.gmail.email;
}

async function disconnectGmail(merchantId) {
  const merchant = await Merchant.findById(merchantId).select(
    '+gmail.encryptedRefreshToken',
  );
  if (!merchant) return { disconnected: false, revoked: false };

  let revoked = false;
  const encryptedToken = merchant.gmail?.encryptedRefreshToken;
  if (encryptedToken) {
    try {
      const oauth = createOAuthClient();
      await oauth.revokeToken(decryptText(encryptedToken));
      revoked = true;
    } catch {
      // Local token deletion still proceeds if Google's revocation endpoint is unavailable.
    }
  }

  merchant.gmail = { email: null, encryptedRefreshToken: null, historyId: null };
  await merchant.save();
  return { disconnected: true, revoked };
}

module.exports = {
  GMAIL_SCOPE,
  createOAuthClient,
  createConnectUrl,
  completeOAuth,
  disconnectGmail,
};
