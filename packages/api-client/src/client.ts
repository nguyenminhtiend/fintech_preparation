import createClient from 'openapi-fetch';

import type { paths } from './types/api';

export interface ClientConfig {
  baseUrl: string;
  token?: string;
}

export function createApiClient(config: ClientConfig) {
  const client = createClient<paths>({
    baseUrl: config.baseUrl,
  });

  // Add auth interceptor
  client.use({
    onRequest({ request }) {
      if (config.token) {
        request.headers.set('Authorization', `Bearer ${config.token}`);
      }
      return request;
    },
    onResponse({ response }) {
      // Handle global errors
      if (response.status === 401) {
        // Trigger logout or token refresh
        // eslint-disable-next-line no-console
        console.error('Unauthorized');
      }
      return response;
    },
  });

  return client;
}
