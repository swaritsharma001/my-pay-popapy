const { z } = require('zod');

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

const signupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: emailSchema,
    password: z.string().min(8).max(128),
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

module.exports = { signupSchema, loginSchema };
