/**
 * Centralized query key factory following 2025 best practices
 * Provides type-safe query keys with autocomplete and prevents typos
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */
export const queryKeys = {
  // Root key for all API queries
  all: ['api'] as const,

  // Transaction-related query keys
  transactions: {
    all: () => [...queryKeys.all, 'transactions'] as const,
    histories: () => [...queryKeys.transactions.all(), 'history'] as const,
    history: (accountId: string, limit: number) =>
      [...queryKeys.transactions.histories(), { accountId, limit }] as const,
    transfers: () => [...queryKeys.transactions.all(), 'transfers'] as const,
  },

  // Future: Account-related query keys
  accounts: {
    all: () => [...queryKeys.all, 'accounts'] as const,
    lists: () => [...queryKeys.accounts.all(), 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.accounts.lists(), filters] as const,
    details: () => [...queryKeys.accounts.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.accounts.details(), id] as const,
  },
} as const;
