/**
 * Type definitions for API requests and responses
 *
 * These types are derived from the auto-generated OpenAPI types in @repo/api-client.
 * This provides type safety while avoiding duplication.
 *
 * @see packages/api-client/src/types/api.d.ts (auto-generated from apps/backend/openapi.json)
 */

import type { components, paths } from '@repo/api-client';

// ============================================================================
// Transaction History Types
// ============================================================================

export type TransactionHistoryResponse =
  paths['/transactions/history']['get']['responses'][200]['content']['application/json'];

export type TransactionHistoryItem = TransactionHistoryResponse['data'][number];

// ============================================================================
// Transfer Types
// ============================================================================

export type TransferRequest = NonNullable<
  paths['/transactions/transfer']['post']['requestBody']
>['content']['application/json'];

export type TransferResponse =
  paths['/transactions/transfer']['post']['responses'][200]['content']['application/json'];

// ============================================================================
// Account Types
// ============================================================================

export type CreateAccountRequest = NonNullable<
  paths['/accounts']['post']['requestBody']
>['content']['application/json'];

export type AccountResponse =
  paths['/accounts']['post']['responses'][201]['content']['application/json'];

export type BalanceResponse =
  paths['/accounts/{id}/balance']['get']['responses'][200]['content']['application/json'];

// ============================================================================
// Schema Components (if needed)
// ============================================================================

// Re-export components for direct access to schemas
export type { components };
