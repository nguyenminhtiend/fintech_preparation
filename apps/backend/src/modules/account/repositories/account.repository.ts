import { type Database } from '@shared/database';

import { type AccountEntity } from '../interfaces/account.entity';

export interface CreateAccountData {
  customerId: string;
  accountNumber: string;
  currency: string;
}

export class AccountRepository {
  constructor(private readonly db: Database) {}

  async create(data: CreateAccountData): Promise<AccountEntity> {
    return await this.db.account.create({
      data: {
        customerId: data.customerId,
        accountNumber: data.accountNumber,
        currency: data.currency,
        balance: BigInt(0),
        availableBalance: BigInt(0),
        version: 1,
      },
    });
  }

  async findById(id: string): Promise<AccountEntity | null> {
    return await this.db.account.findUnique({
      where: { id },
    });
  }

  async findByAccountNumber(accountNumber: string): Promise<AccountEntity | null> {
    return await this.db.account.findUnique({
      where: { accountNumber },
    });
  }
}
