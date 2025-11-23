import { z } from 'zod';

export const createAccountSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID format'),
  currency: z.string().length(3, 'Currency must be 3 characters (e.g., USD, EUR)').toUpperCase(),
});
export type CreateAccountDto = z.infer<typeof createAccountSchema>;

export interface AccountResponse {
  id: string;
  customerId: string | null;
  accountNumber: string;
  balance: number;
  availableBalance: number;
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceResponse {
  balance: number;
  availableBalance: number;
  currency: string;
  version: number;
}
