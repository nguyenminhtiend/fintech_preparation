# Fintech Problems & Solutions (2025 Industry Standards)

## 1. Race Conditions & Concurrent Transactions

**Problem:** Multiple simultaneous transactions can cause balance inconsistencies.

**Current:** `version` field exists in `account.prisma:17`

**Solutions:**
- Optimistic locking: `UPDATE accounts SET balance = X WHERE id = Y AND version = Z`
- Pessimative locking: `SELECT FOR UPDATE` during critical operations
- Queue-based: Single-threaded processing per account (Kafka partitioning)
- Distributed locks: Redis/DynamoDB for multi-instance environments

---

## 2. Idempotency & Duplicate Prevention

**Problem:** Network retries cause duplicate charges.

**Current:** `idempotencyKey` in `transaction.prisma:9`

**Solutions:**
- Store idempotency responses (24-48h TTL)
- Add unique constraint: `@@unique([customerId, idempotencyKey])`
- Use Redis for fast duplicate detection
- Return cached response for duplicate requests

---

## 3. Double-Entry Accounting Integrity

**Problem:** Debits must equal credits; imbalances cause audit failures.

**Current:** Basic `LedgerEntry` model exists

**Solutions:**
- Add constraint: `SUM(debits) = SUM(credits) per transaction`
- Make ledger immutable (no UPDATE/DELETE)
- Hourly reconciliation jobs
- Add `balanceAfter` for audit trail (already exists at `ledger.prisma:10`)

**Missing Table:**
```prisma
model DailyReconciliation {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  accountId String @db.Uuid
  businessDate DateTime @db.Date
  openingBalance BigInt
  closingBalance BigInt
  totalDebits BigInt
  totalCredits BigInt
  discrepancyAmount BigInt @default(0)
  status String // MATCHED, DISCREPANCY
  @@unique([accountId, businessDate])
  @@map("daily_reconciliations")
}
```

---

## 4. Two-Phase Commit for Holds

**Problem:** Need to reserve funds during payment processing.

**Current:** `TransactionReservation` exists in `transaction.prisma:38`

**Missing:**
- Expiry cleanup job for `expiresAt` field
- Calculate: `availableBalance = balance - SUM(active_reservations)`
- Transition logic: ACTIVE → CLAIMED/RELEASED

---

## 5. Money Precision

**Problem:** Floating-point causes rounding errors.

**Current:** Using `BigInt` (correct approach)

**Best Practices:**
- Store smallest unit (cents, not dollars)
- Never use DECIMAL/FLOAT
- Document rounding rules
- Multi-currency support with exchange rates

---

## 6. KYC/AML Compliance

**Problem:** Regulatory requirements (BSA, GDPR, PSD2).

**Current:** Basic `kycStatus` and `riskScore` in `customer.prisma:6-7`

**Missing Tables:**
```prisma
model KYCDocument {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  customerId String @db.Uuid
  documentType String @db.VarChar(50) // PASSPORT, DRIVERS_LICENSE
  verificationStatus String @db.VarChar(20)
  verifiedAt DateTime? @db.Timestamptz
  expiryDate DateTime? @db.Date
  metadata Json @db.JsonB
  @@map("kyc_documents")
}

model TransactionAlert {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  transactionId String @db.Uuid
  alertType String @db.VarChar(50) // VELOCITY, AMOUNT_THRESHOLD, PATTERN
  severity String @db.VarChar(20) // LOW, MEDIUM, HIGH, CRITICAL
  status String @db.VarChar(20) // NEW, UNDER_REVIEW, CLEARED
  reviewedBy String? @db.Uuid
  reviewedAt DateTime? @db.Timestamptz
  @@map("transaction_alerts")
}
```

**Monitoring Rules:**
- Velocity: >5 transactions in 5 minutes
- Amount: Single transaction >$10K (CTR filing requirement)
- Daily limit: >$25K cumulative
- Geographic anomalies: New country detection
- Pattern: Structuring detection (<$10K increments)

---

## 7. Failed Transaction Handling

**Problem:** External providers timeout/fail mid-transaction.

**Missing Tables:**
```prisma
model TransactionStateLog {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  transactionId String @db.Uuid
  previousStatus String @db.VarChar(20)
  newStatus String @db.VarChar(20)
  reason String? @db.Text
  metadata Json @db.JsonB
  createdAt DateTime @default(now()) @db.Timestamptz
  @@index([transactionId, createdAt])
  @@map("transaction_state_logs")
}

model FailedTransaction {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  originalTransactionId String @db.Uuid
  failureReason String @db.Text
  failureCode String @db.VarChar(50)
  retryCount Int @default(0)
  maxRetries Int @default(3)
  nextRetryAt DateTime? @db.Timestamptz
  status String @db.VarChar(20) // RETRYING, MANUAL_REVIEW, ABANDONED
  @@map("failed_transactions")
}
```

**Solutions:**
- Saga pattern for distributed transactions
- Compensation transactions for rollbacks
- Dead letter queue for failed webhooks
- Circuit breaker for external APIs

---

## 8. Enhanced Audit Trail

**Current:** Basic `AuditLog` in `audit.prisma`

**Add Fields:**
```prisma
model AuditLog {
  // ... existing fields ...
  userAgent String? @db.VarChar(255)
  sessionId String? @db.Uuid
  previousValue Json? @db.JsonB
  context Json? @db.JsonB
  complianceFlags String[] @db.VarChar(20)[]

  @@index([resourceType, resourceId, createdAt])
  @@index([userId, createdAt])
}
```

**Best Practices:**
- Append-only (immutable)
- 7-year retention for financial records
- Include correlation IDs
- Cryptographic hash chain for integrity

---

## 9. PCI DSS Compliance

**Current:** Storing `providerToken` in `payment.prisma:11` (correct)

**Critical Rules:**
- NEVER store full PAN (card number)
- NEVER store CVV/CVC
- Only tokenized references from gateway
- Encrypt `providerToken` at application level
- Use vault services (Stripe, Adyen)

---

## 10. Fraud Detection

**Missing Tables:**
```prisma
model FraudScore {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  transactionId String @db.Uuid
  overallScore Decimal @db.Decimal(5,2) // 0-100
  factors Json @db.JsonB
  decision String @db.VarChar(20) // APPROVE, DECLINE, REVIEW
  reviewRequired Boolean @default(false)
  createdAt DateTime @default(now()) @db.Timestamptz
  @@map("fraud_scores")
}
```

**ML Models (2025):**
- Anomaly detection (isolation forests)
- Graph networks for account linkage
- Real-time scoring (<100ms latency)
- Explainable AI for compliance

---

## 11. Rate Limiting

**Missing Table:**
```prisma
model RateLimit {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  identifier String @db.VarChar(255) // user_id, ip_address
  resource String @db.VarChar(100)
  requestCount Int
  windowStart DateTime @db.Timestamptz
  windowEnd DateTime @db.Timestamptz
  @@unique([identifier, resource, windowStart])
  @@map("rate_limits")
}
```

---

## 12. Webhook Delivery

**Missing Table:**
```prisma
model WebhookEvent {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventType String @db.VarChar(100)
  payload Json @db.JsonB
  attempts Int @default(0)
  maxAttempts Int @default(3)
  status String @db.VarChar(20) // PENDING, DELIVERED, FAILED
  nextRetryAt DateTime? @db.Timestamptz
  deliveredAt DateTime? @db.Timestamptz
  @@index([status, nextRetryAt])
  @@map("webhook_events")
}
```

---

## 13. Inter-Bank Transfers (Bank A → Bank B)

**Problem:** Ensuring data integrity across different banking systems with network failures, timeouts, and eventual consistency.

### Architecture Overview

```
User (Bank A) → Bank A System → Payment Network → Bank B System → Recipient (Bank B)
                    ↓                  ↓                  ↓
              Local Ledger      Settlement Layer    Remote Ledger
```

### Required Tables

```prisma
model ExternalTransfer {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  internalTransactionId String @db.Uuid // Link to local Transaction

  // Routing Information
  senderBankCode String @db.VarChar(20) // SWIFT/BIC or routing number
  receiverBankCode String @db.VarChar(20)
  receiverAccountNumber String @db.VarChar(50)
  receiverName String @db.VarChar(255)

  // Payment Network Details
  networkType String @db.VarChar(20) // ACH, WIRE, SWIFT, SEPA, FedWire
  networkReferenceId String? @unique @db.VarChar(100) // From payment network

  // State Management
  status String @db.VarChar(30) // INITIATED, SENT, ACCEPTED, SETTLED, FAILED, RETURNED

  // Amounts
  amount BigInt
  currency String @db.Char(3)
  fees BigInt @default(0)
  exchangeRate Decimal? @db.Decimal(20,10)

  // Timestamps for tracking
  initiatedAt DateTime @default(now()) @db.Timestamptz
  sentToNetworkAt DateTime? @db.Timestamptz
  acceptedByNetworkAt DateTime? @db.Timestamptz
  settledAt DateTime? @db.Timestamptz

  // Reconciliation
  reconciliationStatus String @default("PENDING") @db.VarChar(20)
  reconciledAt DateTime? @db.Timestamptz

  @@index([networkReferenceId])
  @@index([status, initiatedAt])
  @@map("external_transfers")
}

model SettlementInstruction {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  externalTransferId String @db.Uuid

  // ISO 20022 message format
  messageType String @db.VarChar(20) // pacs.008, pain.001, etc.
  messageContent Json @db.JsonB // Full ISO 20022 XML/JSON message

  status String @db.VarChar(20) // PENDING, SENT, ACKNOWLEDGED, REJECTED
  sentAt DateTime? @db.Timestamptz
  acknowledgedAt DateTime? @db.Timestamptz

  @@map("settlement_instructions")
}

model ReconciliationMatch {
  id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  externalTransferId String @db.Uuid

  // External statement data
  statementDate DateTime @db.Date
  statementAmount BigInt
  statementReference String @db.VarChar(100)

  matchStatus String @db.VarChar(20) // MATCHED, UNMATCHED, EXCEPTION
  matchedAt DateTime? @db.Timestamptz
  exceptionReason String? @db.Text

  @@index([statementDate, matchStatus])
  @@map("reconciliation_matches")
}
```

### Data Integrity Patterns

#### 1. **Two-Phase Commit with Compensation (SAGA Pattern)**

**Phase 1: Local Debit (Bank A)**
```sql
BEGIN TRANSACTION;
  -- 1. Lock sender account
  SELECT * FROM accounts WHERE id = $sender_id FOR UPDATE;

  -- 2. Verify sufficient balance
  IF balance >= $amount THEN
    -- 3. Create transaction record
    INSERT INTO transactions (type, status, amount, from_account_id)
    VALUES ('EXTERNAL_TRANSFER', 'PENDING', $amount, $sender_id);

    -- 4. Debit sender account
    UPDATE accounts
    SET balance = balance - $amount,
        available_balance = available_balance - $amount,
        version = version + 1
    WHERE id = $sender_id AND version = $current_version;

    -- 5. Create ledger entry
    INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount)
    VALUES ($txn_id, $sender_id, 'DEBIT', $amount);

    -- 6. Create external transfer record
    INSERT INTO external_transfers (status, internal_transaction_id)
    VALUES ('INITIATED', $txn_id);
COMMIT;
```

**Phase 2: Network Submission**
```typescript
// Send to payment network (ACH, SWIFT, etc.)
try {
  const networkResponse = await paymentNetwork.submit({
    amount, currency, receiverBank, receiverAccount
  });

  await db.externalTransfer.update({
    where: { id: transferId },
    data: {
      status: 'SENT',
      networkReferenceId: networkResponse.referenceId,
      sentToNetworkAt: new Date()
    }
  });
} catch (error) {
  // Compensation: Reverse local debit
  await compensateFailedTransfer(transferId);
}
```

**Phase 3: Settlement & Reconciliation**
```typescript
// Webhook from payment network
async function handleSettlementNotification(notification) {
  await db.externalTransfer.update({
    where: { networkReferenceId: notification.refId },
    data: {
      status: 'SETTLED',
      settledAt: notification.settledAt
    }
  });

  // Update transaction status
  await db.transaction.update({
    where: { id: transfer.internalTransactionId },
    data: { status: 'COMPLETED', completedAt: new Date() }
  });
}
```

#### 2. **Idempotency Across Networks**

```typescript
// Generate deterministic reference for retry safety
const networkReference = generateIdempotentKey({
  bankId: 'BANKA001',
  accountId: senderAccount.id,
  timestamp: transaction.createdAt,
  amount: transaction.amount,
  nonce: transaction.id
});

// Payment networks deduplicate by reference ID
await paymentNetwork.submit({
  referenceId: networkReference, // Same ref = same transaction
  // ... other fields
});
```

#### 3. **State Machine for Transfer Lifecycle**

```typescript
const TRANSFER_STATE_MACHINE = {
  INITIATED: ['SENT', 'FAILED'],
  SENT: ['ACCEPTED', 'REJECTED', 'TIMEOUT'],
  ACCEPTED: ['SETTLED', 'RETURNED'],
  SETTLED: ['RECONCILED'],
  FAILED: ['COMPENSATED'],
  RETURNED: ['COMPENSATED'],
};

async function transitionState(transferId, newStatus) {
  const transfer = await db.externalTransfer.findUnique({
    where: { id: transferId }
  });

  const allowedTransitions = TRANSFER_STATE_MACHINE[transfer.status];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid transition: ${transfer.status} → ${newStatus}`);
  }

  // Log state change
  await db.transactionStateLog.create({
    data: {
      transactionId: transfer.internalTransactionId,
      previousStatus: transfer.status,
      newStatus,
      reason: 'Network notification'
    }
  });

  await db.externalTransfer.update({
    where: { id: transferId },
    data: { status: newStatus }
  });
}
```

#### 4. **Compensation Transaction (Rollback)**

```typescript
async function compensateFailedTransfer(transferId) {
  const transfer = await db.externalTransfer.findUnique({
    where: { id: transferId },
    include: { internalTransaction: true }
  });

  await db.$transaction(async (tx) => {
    // 1. Credit sender account (reverse debit)
    await tx.account.update({
      where: { id: transfer.internalTransaction.fromAccountId },
      data: {
        balance: { increment: transfer.amount },
        availableBalance: { increment: transfer.amount },
        version: { increment: 1 }
      }
    });

    // 2. Create compensation ledger entry
    await tx.ledgerEntry.create({
      data: {
        transactionId: transfer.internalTransactionId,
        accountId: transfer.internalTransaction.fromAccountId,
        entryType: 'CREDIT',
        amount: transfer.amount,
        // Mark as compensation
        metadata: { type: 'COMPENSATION', originalTxn: transferId }
      }
    });

    // 3. Update transfer status
    await tx.externalTransfer.update({
      where: { id: transferId },
      data: { status: 'COMPENSATED' }
    });

    // 4. Update original transaction
    await tx.transaction.update({
      where: { id: transfer.internalTransactionId },
      data: { status: 'REVERSED' }
    });
  });
}
```

#### 5. **Eventual Consistency & Reconciliation**

```typescript
// Daily reconciliation job
async function reconcileExternalTransfers(businessDate: Date) {
  // 1. Fetch bank statement from network
  const statement = await paymentNetwork.getStatement(businessDate);

  // 2. Match with internal records
  for (const entry of statement.entries) {
    const transfer = await db.externalTransfer.findUnique({
      where: { networkReferenceId: entry.reference }
    });

    if (!transfer) {
      // EXCEPTION: Payment network has record we don't
      await db.reconciliationMatch.create({
        data: {
          statementDate: businessDate,
          statementAmount: entry.amount,
          statementReference: entry.reference,
          matchStatus: 'UNMATCHED',
          exceptionReason: 'Missing internal record'
        }
      });
      continue;
    }

    if (transfer.amount !== entry.amount) {
      // EXCEPTION: Amount mismatch
      await db.reconciliationMatch.create({
        data: {
          externalTransferId: transfer.id,
          statementAmount: entry.amount,
          matchStatus: 'EXCEPTION',
          exceptionReason: `Amount mismatch: ${transfer.amount} vs ${entry.amount}`
        }
      });
      continue;
    }

    // SUCCESS: Match found
    await db.reconciliationMatch.create({
      data: {
        externalTransferId: transfer.id,
        statementAmount: entry.amount,
        statementReference: entry.reference,
        matchStatus: 'MATCHED',
        matchedAt: new Date()
      }
    });

    await db.externalTransfer.update({
      where: { id: transfer.id },
      data: {
        reconciliationStatus: 'RECONCILED',
        reconciledAt: new Date()
      }
    });
  }
}
```

#### 6. **Timeout & Retry Handling**

```typescript
// Background job: Check for stuck transfers
async function monitorPendingTransfers() {
  const TIMEOUT_HOURS = 24;

  const stuckTransfers = await db.externalTransfer.findMany({
    where: {
      status: { in: ['SENT', 'ACCEPTED'] },
      sentToNetworkAt: {
        lt: new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000)
      }
    }
  });

  for (const transfer of stuckTransfers) {
    // Query payment network for status
    const networkStatus = await paymentNetwork.getStatus(
      transfer.networkReferenceId
    );

    if (networkStatus === 'SETTLED') {
      await transitionState(transfer.id, 'SETTLED');
    } else if (networkStatus === 'FAILED') {
      await compensateFailedTransfer(transfer.id);
    } else {
      // Still pending - escalate to manual review
      await alertOps(transfer.id, 'Transfer timeout');
    }
  }
}
```

### Network-Specific Considerations

**ACH (US Domestic)**
- T+1 to T+3 settlement
- Returns can happen up to 60 days later
- Requires NACHA file format
- Same-day ACH: $1M limit per transaction

**Wire Transfer (Fedwire/SWIFT)**
- Real-time settlement (typically < 1 hour)
- Irrevocable once sent
- Higher fees ($15-$50)
- SWIFT MT103 message format

**SEPA (Europe)**
- T+1 settlement
- €999,999,999 limit
- ISO 20022 XML format
- Instant SEPA: 10-second settlement

### Key Integrity Guarantees

1. **At-Least-Once Delivery**: Use idempotency to handle retries
2. **Atomicity**: Local transaction + network submission in SAGA
3. **Eventual Consistency**: Reconciliation catches discrepancies
4. **Auditability**: Full state log from INITIATED → SETTLED
5. **Compensation**: Automatic rollback on failure

---

## Implementation Priority

### Phase 1 - Critical (Week 1)
1. Optimistic locking implementation
2. Idempotency validation middleware
3. Double-entry reconciliation jobs
4. Reservation expiry cleanup

### Phase 2 - High Priority (Week 2-3)
5. KYC document management
6. Transaction monitoring alerts
7. Failed transaction retry logic
8. Fraud scoring system

### Phase 3 - Compliance (Week 4-6)
9. Enhanced audit logging
10. Daily reconciliation automation
11. Rate limiting middleware
12. Webhook event system

---

## Key Metrics to Monitor

- Transaction success rate: >99.9%
- False positive fraud rate: <5%
- Reconciliation discrepancy: 0%
- API latency (P95): <200ms
- Idempotency collision rate: <0.01%
- Fund hold expiry cleanup: <1min SLA
