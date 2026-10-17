const mongoose = require('mongoose');

const parserFailureSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    sender: { type: String, required: true, trim: true, lowercase: true },
    gmailMessageId: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { timestamps: true },
);

parserFailureSchema.index(
  { merchantId: 1, gmailMessageId: 1 },
  { unique: true },
);
parserFailureSchema.index({ merchantId: 1, createdAt: -1 });

module.exports =
  mongoose.models.ParserFailure ||
  mongoose.model('ParserFailure', parserFailureSchema);
