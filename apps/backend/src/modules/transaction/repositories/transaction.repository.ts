import { type Prisma } from '@prisma/client';

import { type Database } from '@shared/database';
import { type JsonValue } from '@shared/utils';

import { type TransactionEntity } from '../interfaces';

export interface TransactionFilter {
  accountId?: string;
  type?: string;
  status?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface ITransactionRepository {
  findById(id: string): Promise<TransactionEntity | null>;
  findByReferenceNumber(referenceNumber: string): Promise<TransactionEntity | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<TransactionEntity | null>;
  findMany(filter: TransactionFilter, pagination: PaginationParams): Promise<TransactionEntity[]>;
  count(filter: TransactionFilter): Promise<number>;
  countPending(accountId: string): Promise<number>;
  getTotalActiveHolds(accountId: string): Promise<bigint>;
}

// Prisma database type (infrastructure layer)
interface PrismaTransaction {
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
  metadata: Prisma.JsonValue;
  createdAt: Date;
  completedAt: Date | null;
}

// Mapper function to convert Prisma types to domain entities
function toDomainEntity(prismaEntity: PrismaTransaction): TransactionEntity {
  return {
    ...prismaEntity,
    metadata: prismaEntity.metadata as JsonValue, // Safe cast - both are JSON compatible
  };
}

export class TransactionRepository implements ITransactionRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<TransactionEntity | null> {
    const result = await this.db.transaction.findUnique({
      where: { id },
    });
    return result ? toDomainEntity(result) : null;
  }

  async findByReferenceNumber(referenceNumber: string): Promise<TransactionEntity | null> {
    const result = await this.db.transaction.findUnique({
      where: { referenceNumber },
    });
    return result ? toDomainEntity(result) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<TransactionEntity | null> {
    const result = await this.db.transaction.findUnique({
      where: { idempotencyKey },
    });
    return result ? toDomainEntity(result) : null;
  }

  async findMany(
    filter: TransactionFilter,
    pagination: PaginationParams,
  ): Promise<TransactionEntity[]> {
    const where = this.buildWhereClause(filter);

    const results = await this.db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pagination.limit,
      skip: pagination.offset,
    });

    return results.map(toDomainEntity);
  }

  async count(filter: TransactionFilter): Promise<number> {
    const where = this.buildWhereClause(filter);
    return await this.db.transaction.count({ where });
  }

  async countPending(accountId: string): Promise<number> {
    return await this.db.transaction.count({
      where: {
        OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
        status: 'PENDING',
      },
    });
  }

  async getTotalActiveHolds(accountId: string): Promise<bigint> {
    const result = await this.db.transactionReservation.aggregate({
      where: {
        accountId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ?? BigInt(0);
  }

  private buildWhereClause(filter: TransactionFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filter.accountId) {
      where.OR = [{ fromAccountId: filter.accountId }, { toAccountId: filter.accountId }];
    }

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) {
        (where.createdAt as Record<string, unknown>).gte = filter.fromDate;
      }
      if (filter.toDate) {
        (where.createdAt as Record<string, unknown>).lte = filter.toDate;
      }
    }

    return where;
  }
}
