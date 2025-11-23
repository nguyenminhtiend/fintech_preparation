import { type Request, type Response } from 'express';

import { type AccountResponse, type BalanceResponse } from '../dto/account.dto';
import { type AccountEntity } from '../interfaces/account.entity';
import { type AccountService } from '../services/account.service';

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  createAccount = async (req: Request, res: Response): Promise<void> => {
    // Validation is now handled by middleware
    const { customerId, currency } = req.body;
    const account = await this.accountService.createAccount({
      customerId,
      currency,
    });

    const response = this.mapToAccountResponse(account);
    res.status(201).json(response);
  };

  getAccountBalance = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const account = await this.accountService.getAccountBalance(id);

    const response = this.mapToBalanceResponse(account);
    res.json(response);
  };

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

  private mapToBalanceResponse(account: AccountEntity): BalanceResponse {
    return {
      balance: Number(account.balance),
      availableBalance: Number(account.availableBalance),
      currency: account.currency,
      version: account.version,
    };
  }
}
