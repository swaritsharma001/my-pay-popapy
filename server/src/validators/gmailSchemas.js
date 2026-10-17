const { z } = require('zod');

const allowedSendersSchema = z
  .object({
    allowedSenders: z.array(z.string().trim().email().max(254)).min(1).max(10),
  })
  .strict()
  .transform(({ allowedSenders }) => ({
    allowedSenders: [...new Set(allowedSenders.map((email) => email.toLowerCase()))],
  }));

const callbackQuerySchema = z
  .object({
    code: z.string().min(1).max(4096),
    state: z.string().min(1).max(4096),
  })
  .strict();

module.exports = { allowedSendersSchema, callbackQuerySchema };
