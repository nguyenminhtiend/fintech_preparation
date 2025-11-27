import { type Prisma } from '@prisma/client';

import { type Database } from '@shared/database';

export interface AtomicTransferParams {
  fromAccountId: string;
  toAccountId: string;

  amount: bigint;
  currency: string;
  type: string;
  referenceNumber: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface TransferResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface ITransferRepository {
  executeAtomicTransfer(params: AtomicTransferParams): Promise<TransferResult>;
}

export class TransferRepository implements ITransferRepository {
  constructor(private readonly db: Database) {}

  async executeAtomicTransfer(params: AtomicTransferParams): Promise<TransferResult> {
    const {
      fromAccountId,
      toAccountId,
      amount,
      currency,
      type,
      referenceNumber,
      idempotencyKey,
      description,
      metadata = {},
    } = params;

    try {
      return await this.db.$transaction(async (tx) => {
        // 1. PESSIMISTIC LOCK: Lock sender account (prevents concurrent withdrawals)
        const [senderAccount] = await tx.$queryRaw<
          { id: string; balance: bigint; availableBalance: bigint; currency: string }[]
        >`
          SELECT
            id,
            balance,
            available_balance AS "availableBalance",
            currency
          FROM accounts
          WHERE id = ${fromAccountId}::uuid
          FOR UPDATE
        `;

        // 2. CRITICAL: Validate sender has sufficient funds (must be inside transaction)
        if (senderAccount.availableBalance < amount) {
          return {
            success: false,
            error: `Insufficient funds. Available: ${senderAccount.availableBalance}, Required: ${amount}`,
          };
        }

        // 3. Read receiver account (no lock needed - deposits are safe)
        const receiverAccount = await tx.account.findUnique({
          where: { id: toAccountId },
          select: { id: true, balance: true },
        });

        if (!receiverAccount) {
          return { success: false, error: 'Receiver account not found' };
        }

        // 4. Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            type,
            status: 'PENDING',
            amount,
            currency,
            fromAccountId,
            toAccountId,
            referenceNumber,
            idempotencyKey: idempotencyKey ?? null,
            description: description ?? null,
            metadata,
          },
        });

        // 5. Create hold/reservation on sender (locks available balance)
        await tx.transactionReservation.create({
          data: {
            transactionId: transaction.id,
            accountId: fromAccountId,
            amount,
            status: 'ACTIVE',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
          },
        });

        // 6. Debit sender (both balance and availableBalance)
        await tx.account.update({
          where: { id: fromAccountId },
          data: {
            balance: { decrement: amount },
            availableBalance: { decrement: amount },
          },
        });

        // 7. Credit receiver (atomic increment - safe for concurrent deposits)
        await tx.account.update({
          where: { id: toAccountId },
          data: {
            balance: { increment: amount },
            availableBalance: { increment: amount },
          },
        });

        // 8. Mark reservation as CLAIMED
        await tx.transactionReservation.updateMany({
          where: {
            transactionId: transaction.id,
            accountId: fromAccountId,
          },
          data: {
            status: 'CLAIMED',
          },
        });

        // 9. Create ledger entries (double-entry bookkeeping)
        await tx.ledgerEntry.createMany({
          data: [
            {
              transactionId: transaction.id,
              accountId: fromAccountId,
              entryType: 'DEBIT',
              amount,
              balanceAfter: senderAccount.balance - amount,
            },
            {
              transactionId: transaction.id,
              accountId: toAccountId,
              entryType: 'CREDIT',
              amount,
              balanceAfter: receiverAccount.balance + amount,
            },
          ],
        });

        // 10. Update transaction to COMPLETED
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        return {
          success: true,
          transactionId: transaction.id,
        };
      });
    } catch (error) {
      // Database transaction failed
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
