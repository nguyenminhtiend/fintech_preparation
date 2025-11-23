import { type Request, type Response } from 'express';

import { createAccountSchema } from '../dto/account.dto';
import { type AccountService } from '../services/account.service';

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  createAccount = async (req: Request, res: Response): Promise<void> => {
    const data = createAccountSchema.parse(req.body);
    const result = await this.accountService.createAccount(data);

    res.status(201).json(result);
  };

  getAccountBalance = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await this.accountService.getAccountBalance(id);

    res.json(result);
  };
}
