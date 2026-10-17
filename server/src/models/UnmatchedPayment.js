const mongoose = require('mongoose');

const unmatchedPaymentSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    utr: { type: String, required: true, unique: true, trim: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    receivedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['UNMATCHED', 'CLAIMED'],
      default: 'UNMATCHED',
      required: true,
    },
  },
  { timestamps: true },
);

unmatchedPaymentSchema.index({ merchantId: 1, status: 1, receivedAt: -1 });

module.exports =
  mongoose.models.UnmatchedPayment ||
  mongoose.model('UnmatchedPayment', unmatchedPaymentSchema);
