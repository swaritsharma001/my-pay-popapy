const { z } = require('zod');

const upiIdSchema = z
  .string()
  .trim()
  .min(4)
  .max(320)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]{1,254}@[A-Za-z0-9][A-Za-z0-9.-]{1,62}$/,
    'Enter a valid UPI ID such as name@bank',
  );

const webhookUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Webhook URL must use HTTPS and must not include credentials');

const upiBodySchema = z.object({ upiId: upiIdSchema }).strict();
const webhookBodySchema = z.object({ webhookUrl: webhookUrlSchema }).strict();

module.exports = {
  upiIdSchema,
  webhookUrlSchema,
  upiBodySchema,
  webhookBodySchema,
};
