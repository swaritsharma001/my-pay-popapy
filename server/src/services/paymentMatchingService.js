const mongoose = require('mongoose');
const Merchant = require('../models/Merchant');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const ProcessedEmail = require('../models/ProcessedEmail');
const UnmatchedPayment = require('../models/UnmatchedPayment');
const WebhookLog = require('../models/WebhookLog');
const { parseRupeesToPaise, paiseToRupees } = require('../utils/money');

async function isDuplicateMessageOrUtr(gmailMessageId, utr) {
  const [processed, payment, unmatched] = await Promise.all([
    ProcessedEmail.exists({
      $or: [{ gmailMessageId }, { utr }],
    }),
    Payment.exists({
      $or: [{ gmailMessageId }, { utr }],
    }),
    UnmatchedPayment.exists({
      $or: [{ gmailMessageId }, { utr }],
    }),
  ]);
  return Boolean(processed || payment || unmatched);
}

async function matchIncomingPayment({
  merchantId,
  gmailMessageId,
  amount,
  utr,
  receivedAt,
}) {
  const amountPaise = parseRupeesToPaise(amount);
  if (!/^\d{12}$/.test(String(utr))) {
    throw new TypeError('UTR must contain exactly 12 digits');
  }
  if (!(receivedAt instanceof Date) || Number.isNaN(receivedAt.getTime())) {
    throw new TypeError('Payment time must be a valid date');
  }
  if (await isDuplicateMessageOrUtr(gmailMessageId, utr)) {
    return { matched: false, duplicate: true };
  }

  const amountDecimal = mongoose.Types.Decimal128.fromString(
    paiseToRupees(amountPaise),
  );
  const session = await mongoose.startSession();
  let matchResult = null;

  try {
    await session.withTransaction(async () => {
      const alreadyProcessed = await ProcessedEmail.findOne({
        $or: [{ gmailMessageId }, { utr }],
      }).session(session);
      const alreadyPaid = await Payment.findOne({
        $or: [{ gmailMessageId }, { utr }],
      }).session(session);
      const alreadyUnmatched = await UnmatchedPayment.findOne({
        $or: [{ gmailMessageId }, { utr }],
      }).session(session);
      if (alreadyProcessed || alreadyPaid || alreadyUnmatched) {
        matchResult = { matched: false, duplicate: true };
        return;
      }
      await ProcessedEmail.create(
        [{ merchantId, gmailMessageId, utr, receivedAt }],
        { session },
      );

      const order = await Order.findOne({
        merchantId,
        status: 'PENDING',
        payableAmount: amountDecimal,
        createdAt: { $lte: receivedAt },
        expiresAt: { $gte: receivedAt },
      }).session(session);

      if (!order) {
        await UnmatchedPayment.create(
          [
            {
              merchantId,
              utr,
              amount: amountDecimal,
              gmailMessageId,
              receivedAt,
              status: 'UNMATCHED',
            },
          ],
          { session },
        );
        matchResult = { matched: false, unmatched: true };
        return;
      }

      const [payment] = await Payment.create(
        [
          {
            merchantId,
            orderId: order.orderId,
            utr,
            amount: amountDecimal,
            gmailMessageId,
            receivedAt,
          },
        ],
        { session },
      );
      order.status = 'PAID';
      order.paidAt = receivedAt;
      order.utr = utr;
      await order.save({ session });

      const merchant = await Merchant.findById(merchantId)
        .select('+webhookSecret')
        .session(session);
      if (merchant?.webhookUrl && merchant.webhookSecret) {
        await WebhookLog.create(
          [
            {
              merchantId,
              orderId: order.orderId,
              payload: {
                event: 'payment.success',
                order_id: order.orderId,
                payment_id: payment.id,
                utr,
                amount: paiseToRupees(amountPaise),
                paid_at: receivedAt.toISOString(),
              },
              attempts: 0,
              nextRetryAt: new Date(),
            },
          ],
          { session },
        );
      }

      matchResult = { matched: true, orderId: order.orderId, paymentId: payment.id };
    });
  } catch (error) {
    if (error.code === 11000) return { matched: false, duplicate: true };
    throw error;
  } finally {
    await session.endSession();
  }

  return matchResult || { matched: false, duplicate: true };
}

module.exports = { matchIncomingPayment, isDuplicateMessageOrUtr };
