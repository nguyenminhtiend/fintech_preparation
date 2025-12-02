import { createApiClient } from '@repo/api-client';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  // Token will be added dynamically via setAuthToken when auth is implemented
});

// Helper to set auth token (for future use)
export function setAuthToken(token: string | null) {
  apiClient.use({
    onRequest({ request }) {
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    },
  });
}
