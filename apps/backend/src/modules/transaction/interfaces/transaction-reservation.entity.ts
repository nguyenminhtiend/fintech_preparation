export interface TransactionReservationEntity {
  id: string;
  transactionId: string;
  accountId: string;
  amount: bigint;
  expiresAt: Date;
  status: string;
  createdAt: Date;
}
