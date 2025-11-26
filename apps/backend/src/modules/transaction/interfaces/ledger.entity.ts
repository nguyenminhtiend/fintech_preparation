export interface LedgerEntryEntity {
  id: string;
  transactionId: string | null;
  accountId: string | null;
  entryType: string;
  amount: bigint;
  balanceAfter: bigint | null;
  createdAt: Date;
}
