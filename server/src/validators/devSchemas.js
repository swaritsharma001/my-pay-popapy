const { z } = require('zod');

const simulatePaymentSchema = z
  .object({
    order_id: z.string().regex(/^order_[A-Za-z0-9_-]{12}$/),
    utr: z.string().regex(/^\d{12}$/).optional(),
  })
  .strict();

module.exports = { simulatePaymentSchema };
