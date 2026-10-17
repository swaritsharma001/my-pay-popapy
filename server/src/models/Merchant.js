const mongoose = require('mongoose');

const gmailSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true, default: null },
    encryptedRefreshToken: { type: String, default: null, select: false },
    historyId: { type: String, default: null },
  },
  { _id: false },
);

const keysSchema = new mongoose.Schema(
  {
    publicKey: { type: String, default: null },
    secretKeyHash: { type: String, default: null, select: false },
    signingSecretEncrypted: { type: String, default: null, select: false },
  },
  { _id: false },
);

const merchantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    upiId: { type: String, default: null, trim: true, maxlength: 120 },
    gmail: { type: gmailSchema, default: () => ({}) },
    allowedSenders: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: ['no-reply@famapp.in'],
    },
    keys: { type: keysSchema, default: () => ({}) },
    webhookUrl: { type: String, default: null, trim: true, maxlength: 2048 },
    webhookSecret: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

merchantSchema.index({ 'keys.publicKey': 1 }, { unique: true, sparse: true });
merchantSchema.index(
  { 'keys.secretKeyHash': 1 },
  { unique: true, sparse: true },
);

module.exports =
  mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);
