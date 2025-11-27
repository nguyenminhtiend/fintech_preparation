// Transaction History Query DTO (input)
export interface TransactionHistoryQueryDto {
  accountId: string;
  limit?: number; // Default 50, max 100
  cursor?: string; // Format: {createdAt}|{id}
}

// Single transaction item in history (output)
export interface TransactionHistoryItemDto {
  id: string;
  referenceNumber: string;
  type: string;
  amount: string; // String to avoid precision loss, includes sign (+ for credit, - for debit)
  currency: string;
  balanceAfter: string; // Running balance after this transaction
  description: string | null;
  createdAt: string;
  counterparty: {
    accountNumber: string | null;
    accountId: string | null;
  } | null;
}

// Account summary info (output)
export interface TransactionHistorySummaryDto {
  currentBalance: string;
  availableBalance: string;
  pendingTransactions: number;
  totalHolds: string;
}

// Pagination metadata (output)
export interface TransactionHistoryPaginationDto {
  nextCursor: string | null;
  hasMore: boolean;
}

// Complete response (output)
export interface TransactionHistoryResponseDto {
  data: TransactionHistoryItemDto[];
  pagination: TransactionHistoryPaginationDto;
  summary: TransactionHistorySummaryDto;
}
