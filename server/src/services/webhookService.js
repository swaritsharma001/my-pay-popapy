const crypto = require('crypto');
const Merchant = require('../models/Merchant');
const WebhookLog = require('../models/WebhookLog');

const MAX_ATTEMPTS = 6;
const REQUEST_TIMEOUT_MS = 10_000;

function signWebhookBody(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

function retryDelayMs(attemptNumber) {
  return 1000 * 2 ** Math.max(0, attemptNumber - 1);
}

async function deliverOne(log) {
  const merchant = await Merchant.findById(log.merchantId)
    .select('webhookUrl +webhookSecret');
  if (!merchant?.webhookUrl || !merchant.webhookSecret) {
    log.attempts = MAX_ATTEMPTS;
    log.responseStatus = null;
    log.nextRetryAt = null;
    await log.save();
    return;
  }

  const rawBody = JSON.stringify(log.payload);
  const signature = signWebhookBody(rawBody, merchant.webhookSecret);
  const attemptedAt = new Date();
  let responseStatus = 0;
  try {
    const response = await fetch(merchant.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-PopPay-Signature': signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    responseStatus = response.status;
  } catch {
    responseStatus = 0;
  }

  log.attempts += 1;
  log.responseStatus = responseStatus;
  log.attemptHistory.push({ attemptedAt, responseStatus });
  if (responseStatus >= 200 && responseStatus < 300) {
    log.nextRetryAt = null;
  } else if (log.attempts < MAX_ATTEMPTS) {
    log.nextRetryAt = new Date(Date.now() + retryDelayMs(log.attempts));
  } else {
    log.nextRetryAt = null;
  }
  await log.save();
}

async function deliverDueWebhooks() {
  const due = await WebhookLog.find({
    attempts: { $lt: MAX_ATTEMPTS },
    nextRetryAt: { $lte: new Date() },
  })
    .sort({ nextRetryAt: 1 })
    .limit(25);
  for (const log of due) {
    try {
      await deliverOne(log);
    } catch (error) {
      console.error('Webhook delivery failed:', error.name || 'Error');
    }
  }
}

module.exports = {
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  signWebhookBody,
  retryDelayMs,
  deliverOne,
  deliverDueWebhooks,
};
