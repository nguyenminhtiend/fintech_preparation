import { z } from 'zod';

export const createAccountSchema = z.object({
  customerId: z.uuid('Invalid customer ID format'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD, EUR)').toUpperCase(),
});

// Response schemas with OpenAPI metadata
export const accountResponseSchema = z
  .object({
    id: z.uuid(),
    customerId: z.uuid().nullable(),
    accountNumber: z.string(),
    balance: z.number(),
    availableBalance: z.number(),
    currency: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('AccountResponse');

export const balanceResponseSchema = z
  .object({
    balance: z.number(),
    availableBalance: z.number(),
    currency: z.string(),
  })
  .openapi('BalanceResponse');

// Export response types for controllers
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;
