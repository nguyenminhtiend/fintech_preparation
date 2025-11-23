import { NotFoundError } from '@shared/utils/error-handler.util';

import {
  type AccountResponse,
  type BalanceResponse,
  type CreateAccountDto,
} from '../dto/account.dto';
import { type AccountEntity } from '../interfaces/account.entity';
import { type AccountRepository } from '../repositories/account.repository';

export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async createAccount(data: CreateAccountDto): Promise<AccountResponse> {
    const accountNumber = this.generateAccountNumber();

    const existing = await this.accountRepository.findByAccountNumber(accountNumber);
    if (existing) {
      return this.createAccount(data);
    }

    const account = await this.accountRepository.create({
      customerId: data.customerId,
      accountNumber: accountNumber,
      currency: data.currency,
    });

    return this.mapToAccountResponse(account);
  }

  async getAccountBalance(accountId: string): Promise<BalanceResponse> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return {
      balance: Number(account.balance),
      availableBalance: Number(account.availableBalance),
      currency: account.currency,
      version: account.version,
    };
  }

  private generateAccountNumber(): string {
    const min = 1000000000;
    const max = 9999999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private mapToAccountResponse(account: AccountEntity): AccountResponse {
    return {
      id: account.id,
      customerId: account.customerId,
      accountNumber: account.accountNumber,
      balance: Number(account.balance),
      availableBalance: Number(account.availableBalance),
      currency: account.currency,
      version: account.version,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
