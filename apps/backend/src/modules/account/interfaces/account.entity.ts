export interface AccountEntity {
  id: string;
  customerId: string | null;
  accountNumber: string;
  balance: bigint;
  availableBalance: bigint;
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
