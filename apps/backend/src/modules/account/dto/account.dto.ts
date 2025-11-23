import { z } from 'zod';

// Create Account
export const createAccountSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID format'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD, EUR)').toUpperCase(),
});
export type CreateAccountDto = z.infer<typeof createAccountSchema>;

// Account Response
export interface AccountResponse {
  id: string;
  customer_id: string;
  account_number: string;
  balance: number;
  available_balance: number;
  currency: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

// Balance Response
export interface BalanceResponse {
  balance: number;
  available_balance: number;
  currency: string;
  version: number;
}
