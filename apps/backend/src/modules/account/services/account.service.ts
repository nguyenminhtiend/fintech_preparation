import { type Account } from '@prisma/client';
import { ConflictError, NotFoundError } from '@shared/utils/error-handler.util';
import { logger } from '@shared/utils/logger.util';

import {
  type AccountResponse,
  type BalanceResponse,
  type CreateAccountDto
} from '../dto/account.dto';
import { type AccountRepository } from '../repositories/account.repository';

export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async createAccount(data: CreateAccountDto): Promise<AccountResponse> {
    logger.info('Creating account', { customer_id: data.customer_id, currency: data.currency });

    // Generate random 10-digit account number
    const accountNumber = this.generateAccountNumber();

    // Check if account number already exists (unlikely but possible)
    const existing = await this.accountRepository.findByAccountNumber(accountNumber);
    if (existing) {
      // Retry with new number
      return this.createAccount(data);
    }

    const account = await this.accountRepository.create({
      customer_id: data.customer_id,
      account_number: accountNumber,
      currency: data.currency
    });

    logger.info('Account created successfully', {
      account_id: account.id,
      account_number: accountNumber
    });

    return this.mapToAccountResponse(account);
  }

  async getAccountBalance(accountId: string): Promise<BalanceResponse> {
    logger.info('Fetching account balance', { account_id: accountId });

    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    return {
      balance: Number(account.balance),
      available_balance: Number(account.availableBalance),
      currency: account.currency,
      version: account.version
    };
  }

  private generateAccountNumber(): string {
    // Generate random 10-digit number
    // Ensure it doesn't start with 0
    const min = 1000000000; // 10 digits, starts with 1
    const max = 9999999999; // 10 digits, ends with 9
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private mapToAccountResponse(account: Account): AccountResponse {
    return {
      id: account.id,
      customer_id: account.customerId,
      account_number: account.accountNumber,
      balance: Number(account.balance),
      available_balance: Number(account.availableBalance),
      currency: account.currency,
      version: account.version,
      created_at: account.createdAt,
      updated_at: account.updatedAt
    };
  }
}
