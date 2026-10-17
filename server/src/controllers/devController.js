const crypto = require('crypto');
const Order = require('../models/Order');
const { validationError } = require('./authController');
const { simulatePaymentSchema } = require('../validators/devSchemas');
const { decimalToPaise, paiseToRupees } = require('../utils/money');
const { matchIncomingPayment } = require('../services/paymentMatchingService');

async function simulatePayment(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Route not found' });
  }
  const parsed = simulatePaymentSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  try {
    const order = await Order.findOne({
      merchantId: req.merchantId,
      orderId: parsed.data.order_id,
      status: 'PENDING',
    });
    if (!order) return res.status(404).json({ error: 'Pending order not found' });

    const utr = parsed.data.utr || String(crypto.randomInt(0, 1_000_000_000_000)).padStart(12, '0');
    const result = await matchIncomingPayment({
      merchantId: req.merchantId,
      gmailMessageId: `sim_${crypto.randomUUID()}`,
      amount: paiseToRupees(decimalToPaise(order.payableAmount)),
      utr,
      receivedAt: new Date(),
    });
    return res.status(result.matched ? 200 : 202).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { simulatePayment };
