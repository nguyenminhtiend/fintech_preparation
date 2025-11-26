import { type JsonValue } from '@shared/utils';

export interface TransactionEntity {
  id: string;
  idempotencyKey: string | null;
  referenceNumber: string;
  type: string;
  status: string;
  amount: bigint;
  currency: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  description: string | null;
  metadata: JsonValue;
  createdAt: Date;
  completedAt: Date | null;
}
