const mongoose = require('mongoose');

// A single ledger entry enforces global deduplication across matched and unmatched
// transfers, which separate Payment and UnmatchedPayment indexes cannot guarantee.
const processedEmailSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    gmailMessageId: { type: String, required: true, unique: true, trim: true },
    utr: { type: String, required: true, unique: true, trim: true },
    receivedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

processedEmailSchema.index({ merchantId: 1, receivedAt: -1 });

module.exports =
  mongoose.models.ProcessedEmail ||
  mongoose.model('ProcessedEmail', processedEmailSchema);
