import { type Database } from '@shared/database';

import { type LedgerEntryEntity } from '../interfaces';

export interface LedgerFilter {
  accountId?: string;
  transactionId?: string;
  entryType?: string;
}

export interface ILedgerRepository {
  findByTransactionId(transactionId: string): Promise<LedgerEntryEntity[]>;
  findByAccountId(accountId: string, limit?: number): Promise<LedgerEntryEntity[]>;
  getTransactionHistory(
    accountId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<
    (LedgerEntryEntity & {
      transaction: { referenceNumber: string; type: string; description: string | null } | null;
    })[]
  >;
}

export class LedgerRepository implements ILedgerRepository {
  constructor(private readonly db: Database) {}

  async findByTransactionId(transactionId: string): Promise<LedgerEntryEntity[]> {
    return await this.db.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByAccountId(accountId: string, limit = 100): Promise<LedgerEntryEntity[]> {
    return await this.db.ledgerEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getTransactionHistory(
    accountId: string,
    limit: number,
    cursor?: { createdAt: Date; id: string },
  ): Promise<
    (LedgerEntryEntity & {
      transaction: { referenceNumber: string; type: string; description: string | null } | null;
    })[]
  > {
    return await this.db.ledgerEntry.findMany({
      where: {
        accountId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      take: limit + 1, // Fetch one extra to determine if there are more
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        transaction: {
          select: {
            referenceNumber: true,
            type: true,
            description: true,
          },
        },
      },
    });
  }
}
