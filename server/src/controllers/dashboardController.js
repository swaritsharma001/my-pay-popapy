const mongoose = require('mongoose');
const { z } = require('zod');
const Merchant = require('../models/Merchant');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const UnmatchedPayment = require('../models/UnmatchedPayment');
const WebhookLog = require('../models/WebhookLog');
const { serializeOrder } = require('./orderController');
const { validationError } = require('./authController');
const {
  paginationQuerySchema,
  claimUnmatchedSchema,
  claimUnmatchedParamsSchema,
} = require('../validators/dashboardSchemas');
const { decimalToPaise, paiseToRupees } = require('../utils/money');

function indiaDayBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utcMidnight = Date.UTC(
    Number(fields.year),
    Number(fields.month) - 1,
    Number(fields.day),
  );
  const start = new Date(utcMidnight - 330 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function paymentSummary(payment) {
  return {
    payment_id: payment.id,
    order_id: payment.orderId,
    utr: payment.utr,
    amount: paiseToRupees(decimalToPaise(payment.amount)),
    receivedAt: payment.receivedAt,
  };
}

async function stats(req, res, next) {
  try {
    const { start, end } = indiaDayBounds();
    const [todayPayments, todayOrderCount, todayPaidOrderCount, recent] =
      await Promise.all([
        Payment.find({
          merchantId: req.merchantId,
          receivedAt: { $gte: start, $lt: end },
        }).select('amount'),
        Order.countDocuments({
          merchantId: req.merchantId,
          createdAt: { $gte: start, $lt: end },
        }),
        Order.countDocuments({
          merchantId: req.merchantId,
          createdAt: { $gte: start, $lt: end },
          status: 'PAID',
        }),
        Payment.find({ merchantId: req.merchantId })
          .sort({ receivedAt: -1 })
          .limit(5),
      ]);
    const totalPaise = todayPayments.reduce(
      (sum, payment) => sum + BigInt(decimalToPaise(payment.amount)),
      0n,
    );
    return res.json({
      todayCollection: paiseToRupees(totalPaise),
      todayPaymentCount: todayPayments.length,
      successRate: todayOrderCount
        ? Math.round((todayPaidOrderCount / todayOrderCount) * 10000) / 100
        : 0,
      recentPayments: recent.map(paymentSummary),
    });
  } catch (error) {
    return next(error);
  }
}

async function listDashboardOrders(req, res, next) {
  const parsed = paginationQuerySchema
    .extend({ status: z.enum(['CREATED', 'PENDING', 'PAID', 'EXPIRED']).optional() })
    .safeParse(req.query);
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

async function listPayments(req, res, next) {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  try {
    const { page, limit } = parsed.data;
    const filter = { merchantId: req.merchantId };
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);
    return res.json({
      payments: payments.map(paymentSummary),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
}

async function listUnmatched(req, res, next) {
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  try {
    const { page, limit } = parsed.data;
    const filter = { merchantId: req.merchantId, status: 'UNMATCHED' };
    const [payments, total, pendingOrders] = await Promise.all([
      UnmatchedPayment.find(filter)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      UnmatchedPayment.countDocuments(filter),
      Order.find({
        merchantId: req.merchantId,
        status: { $in: ['PENDING', 'EXPIRED'] },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('orderId payableAmount receipt expiresAt createdAt'),
    ]);
    return res.json({
      payments: payments.map((payment) => ({
        id: payment.id,
        utr: payment.utr,
        amount: paiseToRupees(decimalToPaise(payment.amount)),
        receivedAt: payment.receivedAt,
      })),
      pendingOrders: pendingOrders.map((order) => ({
        order_id: order.orderId,
        payableAmount: paiseToRupees(decimalToPaise(order.payableAmount)),
        receipt: order.receipt,
        expiresAt: order.expiresAt,
        createdAt: order.createdAt,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
}

async function claimUnmatched(req, res, next) {
  const params = claimUnmatchedParamsSchema.safeParse(req.params);
  if (!params.success) return validationError(res, params.error);
  const parsed = claimUnmatchedSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const session = await mongoose.startSession();
  let paymentId;
  let orderId;
  try {
    await session.withTransaction(async () => {
      const unmatched = await UnmatchedPayment.findOne({
        _id: params.data.id,
        merchantId: req.merchantId,
        status: 'UNMATCHED',
      }).session(session);
      if (!unmatched) {
        const error = new Error('Unmatched payment not found');
        error.status = 404;
        throw error;
      }

      const order = await Order.findOne({
        merchantId: req.merchantId,
        orderId: parsed.data.order_id,
        status: { $in: ['PENDING', 'EXPIRED'] },
        payableAmount: unmatched.amount,
        createdAt: { $lte: unmatched.receivedAt },
        expiresAt: { $gte: unmatched.receivedAt },
      }).session(session);
      if (!order) {
        const error = new Error('No pending order matches this amount and payment time');
        error.status = 409;
        throw error;
      }

      const used = await Payment.findOne({
        $or: [
          { utr: unmatched.utr },
          { gmailMessageId: unmatched.gmailMessageId },
        ],
      }).session(session);
      if (used) {
        const error = new Error('This UTR or Gmail message has already been used');
        error.status = 409;
        throw error;
      }

      const [payment] = await Payment.create(
        [
          {
            merchantId: req.merchantId,
            orderId: order.orderId,
            utr: unmatched.utr,
            amount: unmatched.amount,
            gmailMessageId: unmatched.gmailMessageId,
            receivedAt: unmatched.receivedAt,
          },
        ],
        { session },
      );
      order.status = 'PAID';
      order.paidAt = unmatched.receivedAt;
      order.utr = unmatched.utr;
      await order.save({ session });
      unmatched.status = 'CLAIMED';
      await unmatched.save({ session });

      const merchant = await Merchant.findById(req.merchantId)
        .select('+webhookSecret')
        .session(session);
      if (merchant?.webhookUrl && merchant.webhookSecret) {
        await WebhookLog.create(
          [
            {
              merchantId: req.merchantId,
              orderId: order.orderId,
              payload: {
                event: 'payment.success',
                order_id: order.orderId,
                payment_id: payment.id,
                utr: unmatched.utr,
                amount: paiseToRupees(decimalToPaise(unmatched.amount)),
                paid_at: unmatched.receivedAt.toISOString(),
              },
              attempts: 0,
              nextRetryAt: new Date(),
            },
          ],
          { session },
        );
      }
      paymentId = payment.id;
      orderId = order.orderId;
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'This payment has already been claimed' });
    }
    if (error.status) return res.status(error.status).json({ error: error.message });
    return next(error);
  } finally {
    await session.endSession();
  }
  return res.json({ claimed: true, order_id: orderId, payment_id: paymentId });
}

module.exports = {
  indiaDayBounds,
  paymentSummary,
  stats,
  listDashboardOrders,
  listPayments,
  listUnmatched,
  claimUnmatched,
};
