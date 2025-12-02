import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { apiClient } from '../client';
import { ApiError } from '../errors';
import { queryKeys } from '../query-keys';
import type { TransactionHistoryResponse, TransferRequest, TransferResponse } from '../types';

/**
 * Fetch transaction history for an account
 *
 * Follows 2025 best practices:
 * - Uses query key factory for type-safe keys
 * - Proper error handling with custom ApiError
 * - Extensible with options parameter
 * - Type-safe generics for useQuery
 *
 * @param accountId - Account UUID
 * @param limit - Maximum number of transactions to return (default: 10)
 * @param options - Additional React Query options
 *
 * @example
 * const { data, isLoading, error } = useTransactionHistory(accountId, 10);
 */
export function useTransactionHistory(
  accountId: string,
  limit = 10,
  options?: Omit<
    UseQueryOptions<TransactionHistoryResponse, ApiError>,
    'queryKey' | 'queryFn' | 'enabled'
  >,
) {
  return useQuery<TransactionHistoryResponse, ApiError>({
    queryKey: queryKeys.transactions.history(accountId, limit),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/transactions/history', {
        params: {
          // Type assertion needed due to openapi-typescript not parsing Zod schemas correctly
          query: { accountId, limit: limit.toString() } as never,
        },
      });

      if (error) {
        throw ApiError.fromResponse(error, 'Failed to fetch transaction history');
      }

      // Type narrowing: if no error, data must exist
      return data!;
    },
    enabled: !!accountId,
    ...options,
  });
}

/**
 * Create transfer mutation with automatic cache invalidation
 *
 * Follows 2025 best practices:
 * - Uses query key factory for invalidation
 * - Proper TypeScript generics
 * - Structured error handling
 * - Automatic cache invalidation
 * - Retry strategy for network failures
 *
 * @example
 * const transfer = useTransfer();
 * await transfer.mutateAsync({
 *   fromAccountId: '...',
 *   toAccountId: '...',
 *   amount: '1000',
 *   currency: 'USD',
 *   idempotencyKey: crypto.randomUUID(),
 * });
 */
export function useTransfer() {
  const queryClient = useQueryClient();

  return useMutation<TransferResponse, ApiError, TransferRequest>({
    mutationFn: async (body) => {
      const { data, error } = await apiClient.POST('/transactions/transfer', { body });

      if (error) {
        throw ApiError.fromResponse(error, 'Failed to create transfer');
      }

      return data!;
    },
    onSuccess: () => {
      // Invalidate all transaction history queries using factory
      void queryClient.invalidateQueries({
        queryKey: queryKeys.transactions.histories(),
      });
    },
    // Retry once for transient network failures
    retry: 1,
  });
}
