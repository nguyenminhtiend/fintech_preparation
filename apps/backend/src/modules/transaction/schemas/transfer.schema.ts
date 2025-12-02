import { z } from 'zod';

export const transferSchema = z
  .object({
    fromAccountId: z.uuid('Invalid sender account ID format'),
    toAccountId: z.uuid('Invalid receiver account ID format'),
    amount: z
      .string()
      .regex(/^\d+$/, 'Amount must be a positive integer')
      .refine((val) => BigInt(val) > 0, 'Amount must be greater than 0'),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter code')
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Currency must be uppercase letters'),
    idempotencyKey: z.uuid('Idempotency key must be a valid UUID'),
    description: z.string().max(500).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Cannot transfer to the same account',
    path: ['toAccountId'],
  });

export const transactionQuerySchema = z.object({
  accountId: z.uuid().optional(),
  type: z.enum(['TRANSFER', 'DEPOSIT', 'WITHDRAWAL']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
  fromDate: z.iso.datetime().optional(),
  toDate: z.iso.datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
  offset: z.coerce.number().int().nonnegative().default(0).optional(),
});

// Response schema
export const transferResponseSchema = z.object({
  transactionId: z.uuid(),
  referenceNumber: z.string(),
  status: z.string(),
  amount: z.string(),
  currency: z.string(),
  fromAccountId: z.uuid(),
  toAccountId: z.uuid(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

// Export response type for controllers
export type TransferResponse = z.infer<typeof transferResponseSchema>;
