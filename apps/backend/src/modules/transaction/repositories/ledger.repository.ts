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
}
