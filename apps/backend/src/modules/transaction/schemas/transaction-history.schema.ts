import { z } from 'zod';

// Cursor format: {timestamp}|{uuid}
// Example: 2025-01-26T10:33:29.123Z|550e8400-e29b-41d4-a716-446655440000
const cursorRegex = /^[\d-:.TZ]+\|[a-f0-9-]{36}$/i;

export const transactionHistoryQuerySchema = z.object({
  accountId: z.string().uuid('Invalid account ID format'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),
  cursor: z.string().regex(cursorRegex, 'Invalid cursor format').optional(),
});

export type TransactionHistoryQuery = z.infer<typeof transactionHistoryQuerySchema>;
