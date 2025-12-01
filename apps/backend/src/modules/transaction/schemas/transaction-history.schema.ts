import { z } from 'zod';

// Cursor format: {timestamp}|{uuid}
// Example: 2025-01-26T10:33:29.123Z|550e8400-e29b-41d4-a716-446655440000
const cursorRegex = /^[\d-:.TZ]+\|[a-f0-9-]{36}$/i;

export const transactionHistoryQuerySchema = z.object({
  accountId: z.uuid('Invalid account ID format'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),
  cursor: z.string().regex(cursorRegex, 'Invalid cursor format').optional(),
});

export type TransactionHistoryQuery = z.infer<typeof transactionHistoryQuerySchema>;

// Response schemas
export const transactionHistoryItemSchema = z.object({
  id: z.uuid(),
  referenceNumber: z.string(),
  type: z.string(),
  amount: z.string(),
  currency: z.string(),
  balanceAfter: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  counterparty: z
    .object({
      accountNumber: z.string().nullable(),
      accountId: z.string().nullable(),
    })
    .nullable(),
});

export const transactionHistorySummarySchema = z.object({
  currentBalance: z.string(),
  availableBalance: z.string(),
  pendingTransactions: z.number().int(),
  totalHolds: z.string(),
});

export const transactionHistoryPaginationSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const transactionHistoryResponseSchema = z.object({
  data: z.array(transactionHistoryItemSchema),
  pagination: transactionHistoryPaginationSchema,
  summary: transactionHistorySummarySchema,
});

// Export response types for controllers
export type TransactionHistoryItem = z.infer<typeof transactionHistoryItemSchema>;
export type TransactionHistorySummary = z.infer<typeof transactionHistorySummarySchema>;
export type TransactionHistoryPagination = z.infer<typeof transactionHistoryPaginationSchema>;
export type TransactionHistoryResponse = z.infer<typeof transactionHistoryResponseSchema>;
