const Order = require('../models/Order');
const { pollPendingMerchants } = require('../services/gmailWorkerService');
const { deliverDueWebhooks } = require('../services/webhookService');

let timer = null;
let running = false;

async function runWorkerCycle() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await Order.updateMany(
      { status: 'PENDING', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } },
    );
    await pollPendingMerchants();
    await deliverDueWebhooks();
  } catch (error) {
    console.error('PopPay worker cycle failed:', error.name || 'Error');
  } finally {
    running = false;
  }
}

function startWorkerLoop() {
  if (timer) return timer;
  const configured = Number.parseInt(process.env.GMAIL_POLL_INTERVAL_MS, 10);
  const intervalMs = Number.isSafeInteger(configured) && configured >= 1000
    ? configured
    : 10000;
  void runWorkerCycle();
  timer = setInterval(() => void runWorkerCycle(), intervalMs);
  timer.unref?.();
  return timer;
}

function stopWorkerLoop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { runWorkerCycle, startWorkerLoop, stopWorkerLoop };
