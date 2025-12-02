import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { apiClient } from '../client';
import { ApiError } from '../errors';
import { queryKeys } from '../query-keys';
import type { AccountResponse, BalanceResponse, CreateAccountRequest } from '../types';

/**
 * Create a new account mutation
 *
 * Follows 2025 best practices:
 * - Proper TypeScript generics for type safety
 * - Custom ApiError for structured error handling
 * - Automatic cache invalidation
 * - Retry strategy for network failures
 *
 * @example
 * const createAccount = useCreateAccount();
 * await createAccount.mutateAsync({
 *   customerId: '...',
 *   currency: 'USD',
 * });
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation<AccountResponse, ApiError, CreateAccountRequest>({
    mutationFn: async (body) => {
      const { data, error } = await apiClient.POST('/accounts', { body });

      if (error) {
        throw ApiError.fromResponse(error, 'Failed to create account');
      }

      return data!;
    },
    onSuccess: () => {
      // Invalidate all account lists when new account is created
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.lists(),
      });
    },
    // Retry once for transient network failures
    retry: 1,
  });
}

/**
 * Fetch account balance by account ID
 *
 * Follows 2025 best practices:
 * - Uses query key factory for type-safe keys
 * - Proper error handling with custom ApiError
 * - Extensible with options parameter
 * - Type-safe generics for useQuery
 *
 * @param accountId - Account UUID
 * @param options - Additional React Query options
 *
 * @example
 * const { data, isLoading, error } = useAccountBalance(accountId);
 */
export function useAccountBalance(
  accountId: string,
  options?: Omit<UseQueryOptions<BalanceResponse, ApiError>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  return useQuery<BalanceResponse, ApiError>({
    queryKey: queryKeys.accounts.detail(accountId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/accounts/{id}/balance', {
        params: {
          // Type assertion needed due to openapi-typescript not parsing Zod schemas correctly
          path: { id: accountId } as never,
        },
      });

      if (error) {
        throw ApiError.fromResponse(error, 'Failed to fetch account balance');
      }

      // Type narrowing: if no error, data must exist
      return data!;
    },
    enabled: !!accountId,
    ...options,
  });
}
