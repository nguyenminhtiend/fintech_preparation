export interface AccountEntity {
  id: string;
  customerId: string | null;
  accountNumber: string;
  balance: bigint;
  availableBalance: bigint;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}
