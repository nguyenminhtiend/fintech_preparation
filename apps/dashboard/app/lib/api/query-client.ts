import { QueryClient } from '@tanstack/react-query';

/**
 * Centralized QueryClient configuration following 2025 best practices
 *
 * Key updates for React Query v5:
 * - gcTime (formerly cacheTime) for garbage collection
 * - Network reconnection handling
 * - Global mutation error handling
 * - Optimized defaults for fintech application
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (garbage collection time)
      retry: 1, // Single retry for transient failures
      refetchOnWindowFocus: false, // Prevent unnecessary refetches
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: 1, // Single retry for mutations
      // Global error handling can be extended here
      onError: (error) => {
        // Centralized error logging
        // eslint-disable-next-line no-console
        console.error('Mutation error:', error);
        // Future: Integrate with toast notifications or error reporting service
      },
    },
  },
});
