import { z } from 'zod';

export const createAccountSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD, EUR)').toUpperCase(),
});
