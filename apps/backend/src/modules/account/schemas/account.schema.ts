import { z } from 'zod';

export const createAccountSchema = z.object({
  customerId: z.uuid('Invalid customer ID format'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD, EUR)').toUpperCase(),
});

// Response schemas
export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid().nullable(),
  accountNumber: z.string(),
  balance: z.number(),
  availableBalance: z.number(),
  currency: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const balanceResponseSchema = z.object({
  balance: z.number(),
  availableBalance: z.number(),
  currency: z.string(),
});

// Export response types for controllers
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;
