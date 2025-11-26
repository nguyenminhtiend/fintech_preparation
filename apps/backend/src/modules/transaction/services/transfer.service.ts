import { BadRequestError, ConflictError, NotFoundError } from '@shared/utils';

import { type IAccountRepository } from '../../account/repositories/account.repository';
import { type ITransactionRepository, type ITransferRepository } from '../repositories';

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: bigint;
  currency: string;
  idempotencyKey?: string;
  description?: string;
}

export interface TransferResponse {
  transactionId: string;
  referenceNumber: string;
  status: string;
}

export class TransferService {
  constructor(
    private readonly transferRepository: ITransferRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountRepository: IAccountRepository,
  ) {}

  async transfer(input: TransferInput): Promise<TransferResponse> {
    const { fromAccountId, toAccountId, amount, currency, idempotencyKey, description } = input;

    // 1. Check idempotency - prevent duplicate transfers
    if (idempotencyKey) {
      const existing = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);

      if (existing?.status === 'COMPLETED') {
        // Return existing successful transaction (idempotent)
        return {
          transactionId: existing.id,
          referenceNumber: existing.referenceNumber,
          status: existing.status,
        };
      }

      if (existing?.status === 'PENDING') {
        throw new ConflictError('Transaction is already being processed');
      }
    }

    // 2. Validate accounts exist upfront (before transaction)
    // Pre-flight checks: fail fast for obvious errors
    const [fromAccount, toAccount] = await Promise.all([
      this.accountRepository.findById(fromAccountId),
      this.accountRepository.findById(toAccountId),
    ]);

    // Sender account checks
    if (!fromAccount) {
      throw new NotFoundError('Sender account not found');
    }
    if (fromAccount.currency !== currency) {
      throw new BadRequestError(
        `Sender account currency ${fromAccount.currency} does not match transfer currency ${currency}`,
      );
    }

    // Receiver account checks
    if (!toAccount) {
      throw new NotFoundError('Receiver account not found');
    }
    if (toAccount.currency !== currency) {
      throw new BadRequestError(
        `Receiver account currency ${toAccount.currency} does not match transfer currency ${currency}`,
      );
    }

    // 3. Generate reference number
    const referenceNumber = this.generateReferenceNumber();

    // 4. Execute atomic transfer with pessimistic locking
    // Repository will lock sender account, validate, and execute transfer
    const result = await this.transferRepository.executeAtomicTransfer({
      fromAccountId,
      toAccountId,
      amount,
      currency,
      type: 'TRANSFER',
      referenceNumber,
      idempotencyKey,
      description,
      metadata: {
        initiatedAt: new Date().toISOString(),
      },
    });

    if (!result.success) {
      throw new BadRequestError(result.error ?? 'Transfer failed');
    }

    // 5. Success!
    return {
      transactionId: result.transactionId!,
      referenceNumber,
      status: 'COMPLETED',
    };
  }

  private generateReferenceNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `TXN${timestamp}${random}`;
  }
}
