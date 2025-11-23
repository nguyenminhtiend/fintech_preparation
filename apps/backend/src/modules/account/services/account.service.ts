import { NotFoundError } from '@shared/utils/error-handler.util';

import { type AccountEntity } from '../interfaces/account.entity';
import { type IAccountRepository } from '../repositories/account.repository';

export interface CreateAccountInput {
  customerId: string;
  currency: string;
}

export class AccountService {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async createAccount(input: CreateAccountInput): Promise<AccountEntity> {
    const accountNumber = this.generateAccountNumber();

    const existing = await this.accountRepository.findByAccountNumber(accountNumber);
    if (existing) {
      return this.createAccount(input);
    }

    const account = await this.accountRepository.create({
      customerId: input.customerId,
      accountNumber: accountNumber,
      currency: input.currency,
    });

    return account;
  }

  async getAccountBalance(accountId: string): Promise<AccountEntity> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return account;
  }

  private generateAccountNumber(): string {
    const min = 1000000000;
    const max = 9999999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
}
