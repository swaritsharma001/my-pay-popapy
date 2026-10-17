const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const {
  decimalToPaise,
  paiseToRupees,
  pickUniquePayablePaise,
} = require('../utils/money');

function createOrderId() {
  return `order_${crypto.randomBytes(9).toString('base64url')}`;
}

async function createPendingOrder({ merchantId, amountPaise, receipt, redirectUrl }) {
  await Order.updateMany(
    { merchantId, status: 'PENDING', expiresAt: { $lte: new Date() } },
    { $set: { status: 'EXPIRED' } },
  );
  const baseAmount = paiseToRupees(amountPaise);
  const minPayable = mongoose.Types.Decimal128.fromString(
    paiseToRupees(amountPaise + 1),
  );
  const maxPayable = mongoose.Types.Decimal128.fromString(
    paiseToRupees(amountPaise + 99),
  );
  const occupied = await Order.find({
    merchantId,
    status: 'PENDING',
    payableAmount: { $gte: minPayable, $lte: maxPayable },
  }).select('payableAmount');
  const usedPaise = new Set(occupied.map((order) => decimalToPaise(order.payableAmount)));
  const startingOffset = crypto.randomInt(0, 99);
  const attemptedPaise = new Set();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  for (let attempt = 0; attempt < 99; attempt += 1) {
    const payablePaise = pickUniquePayablePaise(
      amountPaise,
      new Set([...usedPaise, ...attemptedPaise]),
      (startingOffset + attempt) % 99,
    );
    if (payablePaise === null) break;
    attemptedPaise.add(payablePaise);

    const order = new Order({
      merchantId,
      orderId: createOrderId(),
      receipt,
      baseAmount,
      payableAmount: paiseToRupees(payablePaise),
      status: 'PENDING',
      redirectUrl: redirectUrl || null,
      expiresAt,
    });

    try {
      await order.save();
      return order;
    } catch (error) {
      // The partial unique index is the final authority when concurrent creates race.
      if (error.code === 11000) {
        usedPaise.add(payablePaise);
        continue;
      }
      throw error;
    }
  }

  const refreshed = await Order.find({
    merchantId,
    status: 'PENDING',
    payableAmount: { $gte: minPayable, $lte: maxPayable },
  }).select('payableAmount');
  const allUsed = new Set(refreshed.map((order) => decimalToPaise(order.payableAmount)));
  if (allUsed.size >= 99) {
    const firstCandidate = amountPaise + 1;
    if (Array.from({ length: 99 }, (_, i) => firstCandidate + i).every((n) => allUsed.has(n))) {
      const error = new Error('All unique payable amounts are currently in use');
      error.status = 429;
      throw error;
    }
  }

  const error = new Error('Could not reserve a unique payable amount; please retry');
  error.status = 429;
  throw error;
}

module.exports = { createOrderId, createPendingOrder };
