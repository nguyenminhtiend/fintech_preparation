import { NotFoundError } from '@shared/utils';

import { type IAccountRepository } from '../../account/repositories';
import {
  type TransactionHistoryItemDto,
  type TransactionHistoryQueryDto,
  type TransactionHistoryResponseDto,
} from '../dto';
import { type ILedgerRepository, type ITransactionRepository } from '../repositories';

export class TransactionHistoryService {
  constructor(
    private readonly ledgerRepository: ILedgerRepository,
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountRepository: IAccountRepository,
  ) {}

  async getTransactionHistory(
    query: TransactionHistoryQueryDto,
  ): Promise<TransactionHistoryResponseDto> {
    const { accountId, limit = 50, cursor } = query;

    // 1. Verify account exists
    const account = await this.accountRepository.findById(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // 2. Parse cursor
    let parsedCursor: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      const [createdAtStr, id] = cursor.split('|');
      if (createdAtStr && id) {
        parsedCursor = { createdAt: new Date(createdAtStr), id };
      }
    }

    // 3. Fetch data in parallel
    const [ledgerEntries, pendingCount, totalHolds] = await Promise.all([
      this.ledgerRepository.getTransactionHistory(accountId, limit, parsedCursor),
      this.transactionRepository.countPending(accountId),
      this.transactionRepository.getTotalActiveHolds(accountId),
    ]);

    // 4. Determine pagination
    const hasMore = ledgerEntries.length > limit;
    const items = hasMore ? ledgerEntries.slice(0, limit) : ledgerEntries;

    const nextCursor =
      hasMore && items.length > 0
        ? `${items[items.length - 1].createdAt.toISOString()}|${items[items.length - 1].id}`
        : null;

    // 5. Map to DTOs
    const historyItems: TransactionHistoryItemDto[] = items.map((entry) => {
      const isCredit = entry.entryType === 'CREDIT';
      // Format amount: negative for DEBIT, positive for CREDIT
      const signedAmount = isCredit ? entry.amount : -entry.amount;

      return {
        id: entry.id,
        referenceNumber: entry.transaction?.referenceNumber ?? 'N/A',
        type: entry.transaction?.type ?? 'UNKNOWN',
        amount: signedAmount.toString(),
        currency: account.currency,
        balanceAfter: entry.balanceAfter?.toString() ?? '0',
        description: entry.transaction?.description ?? null,
        createdAt: entry.createdAt.toISOString(),
        counterparty: null, // Could be enhanced to show counterparty info
      };
    });

    // 6. Construct response
    return {
      data: historyItems,
      pagination: {
        nextCursor,
        hasMore,
      },
      summary: {
        currentBalance: account.balance.toString(),
        availableBalance: account.availableBalance.toString(),
        pendingTransactions: pendingCount,
        totalHolds: totalHolds.toString(),
      },
    };
  }
}
