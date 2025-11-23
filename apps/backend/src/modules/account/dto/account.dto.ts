export interface CreateAccountDto {
  customerId: string;
  currency: string;
}

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
