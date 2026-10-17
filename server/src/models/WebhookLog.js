const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    orderId: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    responseStatus: { type: Number, default: null },
    attempts: { type: Number, default: 0, min: 0, max: 6 },
    nextRetryAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

webhookLogSchema.index({ merchantId: 1, createdAt: -1 });

module.exports =
  mongoose.models.WebhookLog ||
  mongoose.model('WebhookLog', webhookLogSchema);
