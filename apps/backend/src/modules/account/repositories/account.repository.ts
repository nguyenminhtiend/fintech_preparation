import { type Account } from '@prisma/client';
import { type Database } from '@shared/database';

export interface CreateAccountData {
  customer_id: string;
  account_number: string;
  currency: string;
}

export class AccountRepository {
  constructor(private readonly db: Database) {}

  async create(data: CreateAccountData): Promise<Account> {
    return await this.db.account.create({
      data: {
        customerId: data.customer_id,
        accountNumber: data.account_number,
        currency: data.currency,
        balance: BigInt(0),
        availableBalance: BigInt(0),
        version: 1,
      },
    });
  }

  async findById(id: string): Promise<Account | null> {
    return await this.db.account.findUnique({
      where: { id },
    });
  }

  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    return await this.db.account.findUnique({
      where: { accountNumber },
    });
  }
}
