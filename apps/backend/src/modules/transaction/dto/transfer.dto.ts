// Transfer Input DTO
export interface TransferDto {
  fromAccountId: string;
  toAccountId: string;
  amount: string; // String to avoid precision loss
  currency: string;
  idempotencyKey: string;
  description?: string;
}

// Transfer Response DTO
export interface TransferResponseDto {
  transactionId: string;
  referenceNumber: string;
  status: string;
  amount: string;
  currency: string;
  fromAccountId: string;
  toAccountId: string;
  createdAt: string;
  completedAt: string | null;
}

// Transaction History Query DTO
export interface TransactionQueryDto {
  accountId?: string;
  type?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}
