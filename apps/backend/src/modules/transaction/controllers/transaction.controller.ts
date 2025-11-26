import { type Request, type Response } from 'express';

import { type TransferDto, type TransferResponseDto } from '../dto';
import { type TransferService } from '../services';

export class TransactionController {
  constructor(private readonly transferService: TransferService) {}

  transfer = async (req: Request, res: Response): Promise<void> => {
    const { fromAccountId, toAccountId, amount, currency, idempotencyKey, description } =
      req.body as TransferDto;

    // Convert string amount to bigint
    const amountBigInt = BigInt(amount);

    const result = await this.transferService.transfer({
      fromAccountId,
      toAccountId,
      amount: amountBigInt,
      currency,
      idempotencyKey,
      description,
    });

    const response: TransferResponseDto = {
      transactionId: result.transactionId,
      referenceNumber: result.referenceNumber,
      status: result.status,
      amount: amount, // Return original string
      currency,
      fromAccountId,
      toAccountId,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    res.status(201).json(response);
  };
}
