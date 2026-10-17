const { google } = require('googleapis');
const Merchant = require('../models/Merchant');
const Order = require('../models/Order');
const ParserFailure = require('../models/ParserFailure');
const Payment = require('../models/Payment');
const UnmatchedPayment = require('../models/UnmatchedPayment');
const { getRequiredEnv } = require('../config');
const { decryptText } = require('../utils/encryption');
const { parserForSender } = require('../parsers');
const { matchIncomingPayment, isDuplicateMessageOrUtr } = require('./paymentMatchingService');

function headerValue(headers, name) {
  return (headers || []).find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value || '';
}

function parseSender(value) {
  const angle = String(value || '').match(/<([^>]+)>/);
  const email = (angle ? angle[1] : value).trim().toLowerCase();
  return email.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase() || '';
}

function dkimPassForFamApp(authenticationResults) {
  const value = String(authenticationResults || '').toLowerCase();
  return /dkim\s*=\s*pass[^;]*(?:header\.d|header\.i)\s*=\s*@?famapp\.in(?:\s|;|$)/i.test(value);
}

function decodePayloadData(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function collectMessageBodies(payload, parts = []) {
  if (!payload) return parts;
  const mimeType = (payload.mimeType || '').toLowerCase();
  if (payload.body?.data) {
    parts.push({ mimeType, value: decodePayloadData(payload.body.data) });
  }
  for (const part of payload.parts || []) collectMessageBodies(part, parts);
  return parts;
}

function messageBody(payload) {
  const parts = collectMessageBodies(payload);
  return parts.find((part) => part.mimeType === 'text/html')?.value
    || parts.find((part) => part.mimeType === 'text/plain')?.value
    || parts[0]?.value
    || '';
}

async function recordParserFailure(merchantId, sender, gmailMessageId, reason) {
  await ParserFailure.updateOne(
    { merchantId, gmailMessageId },
    { $setOnInsert: { merchantId, sender, gmailMessageId, reason } },
    { upsert: true },
  );
}

function statusCode(error) {
  return error?.code || error?.response?.status || error?.status;
}

async function historyMessageIds(gmail, historyId, allowedSenders) {
  if (historyId) {
    const historyIds = new Set();
    let pageToken;
    let latestHistoryId = historyId;
    try {
      do {
        const response = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: historyId,
          historyTypes: ['messageAdded'],
          maxResults: 100,
          pageToken,
        });
        latestHistoryId = response.data.historyId || latestHistoryId;
        for (const item of response.data.history || []) {
          for (const added of item.messagesAdded || []) {
            if (added.message?.id) historyIds.add(added.message.id);
          }
        }
        pageToken = response.data.nextPageToken;
      } while (pageToken);
      if (!historyIds.size) return { messageIds: [], latestHistoryId };

      // Gmail's search query returns IDs only; intersect it with history changes so
      // metadata/body requests are made only for allowed sender addresses.
      const senderQuery = allowedSenders.map((sender) => `from:${sender}`).join(' ');
      const query = `{${senderQuery}}`;
      const allowedIds = new Set();
      let allowedPageToken;
      let allowedPages = 0;
      do {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 500,
          pageToken: allowedPageToken,
        });
        for (const message of response.data.messages || []) {
          if (message.id && historyIds.has(message.id)) allowedIds.add(message.id);
        }
        allowedPageToken = response.data.nextPageToken;
        allowedPages += 1;
      } while (
        allowedPageToken &&
        allowedPages < 20 &&
        allowedIds.size < historyIds.size
      );
      return { messageIds: [...allowedIds], latestHistoryId };
    } catch (error) {
      if (statusCode(error) !== 404) throw error;
    }
  }

  const senderQuery = allowedSenders.map((sender) => `from:${sender}`).join(' ');
  const query = `newer_than:1d {${senderQuery}}`;
  const messageIds = new Set();
  let pageToken;
  let latestHistoryId = historyId || null;
  let pages = 0;
  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });
    for (const message of response.data.messages || []) {
      if (message.id) messageIds.add(message.id);
    }
    latestHistoryId = response.data.historyId || latestHistoryId;
    pageToken = response.data.nextPageToken;
    pages += 1;
  } while (pageToken && pages < 5);
  return { messageIds: [...messageIds], latestHistoryId };
}

async function handleMessage(gmail, merchant, messageId) {
  const [paid, unmatched, failed] = await Promise.all([
    Payment.exists({ gmailMessageId: messageId }),
    UnmatchedPayment.exists({ gmailMessageId: messageId }),
    ParserFailure.exists({ merchantId: merchant.id, gmailMessageId: messageId }),
  ]);
  if (paid || unmatched || failed) return;

  const metadata = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Authentication-Results'],
  });
  const headers = metadata.data.payload?.headers || [];
  const sender = parseSender(headerValue(headers, 'From'));
  if (!merchant.allowedSenders.includes(sender)) return;

  const parse = parserForSender(sender);
  if (!parse) {
    await recordParserFailure(merchant.id, sender, messageId, 'No parser configured for allowed sender');
    return;
  }
  if (!dkimPassForFamApp(headerValue(headers, 'Authentication-Results'))) {
    await recordParserFailure(merchant.id, sender, messageId, 'DKIM verification failed for famapp.in');
    return;
  }

  const full = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const parsed = parse(messageBody(full.data.payload));
  if (!parsed) {
    await recordParserFailure(merchant.id, sender, messageId, 'Email did not match the FamApp parser');
    return;
  }
  if (parsed.type !== 'credit') return;

  const duplicate = await isDuplicateMessageOrUtr(messageId, parsed.utr);
  if (duplicate) return;
  await matchIncomingPayment({
    merchantId: merchant.id,
    gmailMessageId: messageId,
    amount: parsed.amount,
    utr: parsed.utr,
    receivedAt: parsed.paidAt,
  });
}

async function pollMerchant(merchant) {
  if (!merchant.gmail?.encryptedRefreshToken || !merchant.allowedSenders?.length) return;
  const oauth = new google.auth.OAuth2(
    getRequiredEnv('GMAIL_CLIENT_ID'),
    getRequiredEnv('GMAIL_CLIENT_SECRET'),
    getRequiredEnv('GMAIL_REDIRECT_URI'),
  );
  oauth.setCredentials({
    refresh_token: decryptText(merchant.gmail.encryptedRefreshToken),
  });
  const gmail = google.gmail({ version: 'v1', auth: oauth });
  const { messageIds, latestHistoryId } = await historyMessageIds(
    gmail,
    merchant.gmail.historyId,
    merchant.allowedSenders,
  );
  for (const messageId of messageIds) {
    await handleMessage(gmail, merchant, messageId);
  }
  let currentHistoryId = latestHistoryId;
  if (!currentHistoryId || currentHistoryId === merchant.gmail.historyId) {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    currentHistoryId = profile.data.historyId || currentHistoryId;
  }
  if (currentHistoryId && currentHistoryId !== merchant.gmail.historyId) {
    await Merchant.updateOne(
      { _id: merchant._id },
      { $set: { 'gmail.historyId': currentHistoryId } },
    );
  }
}

async function pollPendingMerchants() {
  const activeMerchantIds = await Order.distinct('merchantId', {
    status: 'PENDING',
    expiresAt: { $gt: new Date() },
  });
  if (!activeMerchantIds.length) return;
  const merchants = await Merchant.find({
    _id: { $in: activeMerchantIds },
    'gmail.encryptedRefreshToken': { $ne: null },
  }).select('+gmail.encryptedRefreshToken');

  for (const merchant of merchants) {
    try {
      await pollMerchant(merchant);
    } catch (error) {
      console.error('Gmail polling failed for a merchant:', error.name || 'Error');
    }
  }
}

module.exports = {
  dkimPassForFamApp,
  parseSender,
  messageBody,
  historyMessageIds,
  handleMessage,
  pollMerchant,
  pollPendingMerchants,
  recordParserFailure,
};
