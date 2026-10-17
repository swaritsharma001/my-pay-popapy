const WebhookLog = require('../models/WebhookLog');
const { z } = require('zod');
const { validationError } = require('./authController');

const webhookIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i),
}).strict();

async function listWebhookLogs(req, res, next) {
  try {
    const logs = await WebhookLog.find({ merchantId: req.merchantId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('orderId payload responseStatus attempts nextRetryAt attemptHistory createdAt updatedAt');
    return res.json({ logs });
  } catch (error) {
    return next(error);
  }
}

async function retryWebhook(req, res, next) {
  const parsed = webhookIdParamsSchema.safeParse(req.params);
  if (!parsed.success) return validationError(res, parsed.error);
  try {
    const log = await WebhookLog.findOne({
      _id: parsed.data.id,
      merchantId: req.merchantId,
    });
    if (!log) return res.status(404).json({ error: 'Webhook log not found' });
    log.attempts = 0;
    log.responseStatus = null;
    log.nextRetryAt = new Date();
    await log.save();
    return res.json({ queued: true, id: log.id });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listWebhookLogs, retryWebhook };
