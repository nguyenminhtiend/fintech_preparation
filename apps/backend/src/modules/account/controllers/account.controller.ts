import { logger } from '@shared/utils/logger.util';
import { type Request, type Response } from 'express';

import { createAccountSchema } from '../dto/account.dto';
import { type AccountService } from '../services/account.service';

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // Arrow function - auto-binds 'this'
  createAccount = async (req: Request, res: Response): Promise<void> => {
    const data = createAccountSchema.parse(req.body);
    const result = await this.accountService.createAccount(data);

    logger.info('Account created via API', { account_id: result.id });
    res.status(201).json(result);
  };

  getAccountBalance = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.accountService.getAccountBalance(id);

    res.json(result);
  };
}
