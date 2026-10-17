const { z } = require('zod');
const { parseRupeesToPaise } = require('../utils/money');

const amountSchema = z
  .union([z.number().finite().transform(String), z.string().trim()])
  .pipe(
    z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/, 'Amount must have at most two decimal places')
      .refine((value) => {
        try {
          parseRupeesToPaise(value);
          return true;
        } catch {
          return false;
        }
      }, 'Amount must be at least ₹1.00 and within the supported range')
      .transform(parseRupeesToPaise),
  );

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === 'https:', 'URL must use HTTPS');

const createOrderSchema = z
  .object({
    amount: amountSchema,
    receipt: z.string().trim().min(1).max(120),
    redirectUrl: httpsUrlSchema.optional(),
  })
  .strict();

const listOrdersQuerySchema = z
  .object({
    status: z.enum(['CREATED', 'PENDING', 'PAID', 'EXPIRED']).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

const orderIdParamsSchema = z
  .object({ id: z.string().regex(/^order_[A-Za-z0-9_-]{12}$/) })
  .strict();
const checkoutOrderParamsSchema = z
  .object({ orderId: z.string().regex(/^order_[A-Za-z0-9_-]{12}$/) })
  .strict();

module.exports = {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  checkoutOrderParamsSchema,
};
