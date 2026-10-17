const { z } = require('zod');

const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

const claimUnmatchedSchema = z
  .object({
    order_id: z.string().regex(/^order_[A-Za-z0-9_-]{12}$/),
  })
  .strict();

const claimUnmatchedParamsSchema = z
  .object({ id: z.string().regex(/^[a-f\d]{24}$/i) })
  .strict();

module.exports = {
  paginationQuerySchema,
  claimUnmatchedSchema,
  claimUnmatchedParamsSchema,
};
