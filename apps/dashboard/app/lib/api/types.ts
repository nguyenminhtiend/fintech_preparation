/**
 * Type definitions for API requests and responses
 *
 * NOTE: These are manually defined as a workaround until openapi-typescript
 * can properly parse Zod-generated OpenAPI schemas. Once tooling compatibility
 * is resolved, these should be auto-generated from the OpenAPI spec.
 *
 * @see apps/backend/openapi.json
 */

// Transaction History Types
export interface TransactionHistoryItem {
  id: string;
  referenceNumber: string;
  type: string;
  amount: string;
  currency: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
  counterparty: {
    accountNumber: string | null;
    accountId: string | null;
  } | null;
}

export interface TransactionHistoryResponse {
  data: TransactionHistoryItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
  summary: {
    currentBalance: string;
    availableBalance: string;
    pendingTransactions: number;
    totalHolds: string;
  };
}

// Transfer Types
export interface TransferRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  currency: string;
  idempotencyKey: string;
  description?: string;
}

export interface TransferResponse {
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

// Future: Account Types
export interface AccountResponse {
  id: string;
  accountNumber: string;
  customerId: string;
  currency: string;
  balance: number;
  availableBalance: number;
  createdAt: string;
}
