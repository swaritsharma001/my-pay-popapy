const crypto = require('crypto');
const Merchant = require('../models/Merchant');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { validationError } = require('./authController');
const {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  checkoutOrderParamsSchema,
} = require('../validators/orderSchemas');
const { decimalToPaise, paiseToRupees } = require('../utils/money');
const { createPendingOrder } = require('../services/orderService');
const { decryptText } = require('../utils/encryption');

function serializeOrder(order) {
  return {
    order_id: order.orderId,
    receipt: order.receipt,
    baseAmount: paiseToRupees(decimalToPaise(order.baseAmount)),
    payableAmount: paiseToRupees(decimalToPaise(order.payableAmount)),
    status: order.status,
    redirectUrl: order.redirectUrl,
    expiresAt: order.expiresAt,
  };
}

async function createOrder(req, res, next) {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);
  try {
    const order = await createPendingOrder({
      merchantId: req.merchantId,
      amountPaise: parsed.data.amount,
      receipt: parsed.data.receipt,
      redirectUrl: parsed.data.redirectUrl,
    });
    return res.status(201).json({
      order_id: order.orderId,
      payableAmount: paiseToRupees(decimalToPaise(order.payableAmount)),
      baseAmount: paiseToRupees(decimalToPaise(order.baseAmount)),
      status: order.status,
      expiresAt: order.expiresAt,
      checkoutUrl: `/pay/${order.orderId}`,
    });
  } catch (error) {
    return next(error);
  }
}

async function getOrder(req, res, next) {
  const parsedParams = orderIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return validationError(res, parsedParams.error);
  try {
    const order = await Order.findOne({
      merchantId: req.merchantId,
      orderId: parsedParams.data.id,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json(serializeOrder(order));
  } catch (error) {
    return next(error);
  }
}

async function listOrders(req, res, next) {
  const parsed = listOrdersQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  try {
    const { status, page, limit } = parsed.data;
    const filter = { merchantId: req.merchantId };
    if (status) filter.status = status;
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    return res.json({
      orders: orders.map(serializeOrder),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
}

async function publicCheckout(req, res, next) {
  const parsedParams = checkoutOrderParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return validationError(res, parsedParams.error);
  try {
    const order = await Order.findOne({ orderId: parsedParams.data.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const merchant = await Merchant.findById(order.merchantId).select(
      'name upiId',
    );
    if (!merchant || !merchant.upiId) {
      return res.status(409).json({ error: 'Merchant payment details are not ready' });
    }

    if (order.status === 'PENDING' && order.expiresAt <= new Date()) {
      order.status = 'EXPIRED';
      await order.save();
    }

    const payableAmount = paiseToRupees(decimalToPaise(order.payableAmount));
    const params = new URLSearchParams({
      pa: merchant.upiId,
      pn: merchant.name,
      am: payableAmount,
      tn: order.orderId,
      cu: 'INR',
    });
    return res.json({
      merchantName: merchant.name,
      payableAmount,
      status: order.status,
      expiresAt: order.expiresAt,
      upiLink: `upi://pay?${params.toString()}`,
    });
  } catch (error) {
    return next(error);
  }
}

async function checkoutStatus(req, res, next) {
  const parsedParams = checkoutOrderParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return validationError(res, parsedParams.error);
  try {
    const order = await Order.findOne({ orderId: parsedParams.data.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'PENDING' && order.expiresAt <= new Date()) {
      order.status = 'EXPIRED';
      await order.save();
    }
    const result = { status: order.status, expiresAt: order.expiresAt };
    if (order.status === 'PAID') {
      const payment = await Payment.findOne({
        merchantId: order.merchantId,
        orderId: order.orderId,
      }).select('_id utr');
      if (payment) {
        result.payment_id = payment.id;
        result.utr = payment.utr;
        const merchant = await Merchant.findById(order.merchantId).select(
          '+keys.signingSecretEncrypted',
        );
        if (merchant?.keys?.signingSecretEncrypted) {
          const signingSecret = decryptText(merchant.keys.signingSecretEncrypted);
          result.signature = crypto
            .createHmac('sha256', signingSecret)
            .update(`${order.orderId}|${payment.id}`, 'utf8')
            .digest('hex');
        }
        if (order.redirectUrl) result.redirectUrl = order.redirectUrl;
      }
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  getOrder,
  listOrders,
  publicCheckout,
  checkoutStatus,
  serializeOrder,
};
