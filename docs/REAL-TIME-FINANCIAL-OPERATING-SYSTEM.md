# Real-Time Financial Operating System

A comprehensive breakdown for building a high-performance, low-latency financial operating system with TypeScript end-to-end type safety and separation of concerns between transactional integrity (Postgres) and analytical speed (ClickHouse).

## 1. Technical Stack (The "High-Performance" Selection)

This stack is optimized for TypeScript end-to-end type safety and separation of concerns between transactional integrity (Postgres) and analytical speed (ClickHouse).

### Frontend (The Control Center)

- **Framework**: React 19 + Vite (SPA focus) or Next.js (if you need server-side rendering)
- **State & Fetching**: TanStack Query (React Query) linked with tRPC Client
- **UI Library**: Tailwind CSS + shadcn/ui (for fast, accessible, professional dashboard components)

### Backend (The Gateway)

- **Runtime**: Node.js (v22+) or Bun (for lower startup time/latency)
- **Framework**: Fastify (preferred over Express for high throughput) or Hono
- **Internal API**: tRPC (Type-safe connection for your Dashboard)
- **External API**: OpenAPI (generated via zod-to-openapi) for client integrations (Banks, Fintechs)

### Data Layer (The "Speed vs. Truth" Split)

- **OLTP (The Ledger/Truth)**: PostgreSQL
  - Managed via Prisma (ease of use) or Drizzle ORM (better performance/SQL control)
  - Holds: User accounts, Balances, Auth
- **OLAP (The Intelligence)**: ClickHouse (via Tinybird for API exposure)
  - Holds: Transaction logs, clickstreams, audit trails, feature vectors
- **Queue**: Redpanda (Kafka-compatible but faster/simpler) for decoupling ingestion from processing
- **Caching**: Redis for rate limiting and deduplication keys

## 2. System Architecture Diagram

This diagram illustrates the "Lambda Architecture" approach: A "Hot Path" for real-time decisions (Fraud/AI) and a "Cold Path" for reliable bookkeeping (Ledger).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                           ┌──────────────────┐        │
│  │  External Client │                           │  Internal Team   │        │
│  │  (Bank/Fintech)  │                           │   Dashboard      │        │
│  │                  │                           │  (React + Vite)  │        │
│  └────────┬─────────┘                           └────────┬─────────┘        │
│           │                                              │                  │
│           │ HTTPS/REST                                   │ tRPC             │
│           │ (OpenAPI)                                    │ (Type-safe)      │
└───────────┼──────────────────────────────────────────────┼──────────────────┘
            │                                              │
            ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │              Fastify/Hono Server (Node.js/Bun)                  │        │
│  │                                                                 │        │
│  │  ┌──────────────────┐              ┌──────────────────┐        │        │
│  │  │  OpenAPI Routes  │              │   tRPC Router    │        │        │
│  │  │  /api/v1/...     │              │   (Internal)     │        │        │
│  │  └────────┬─────────┘              └────────┬─────────┘        │        │
│  │           │                                 │                  │        │
│  │           └─────────────┬───────────────────┘                  │        │
│  │                         │                                      │        │
│  │                    ┌────▼────┐                                 │        │
│  │                    │  Redis  │ (Rate Limiting, Idempotency)    │        │
│  │                    └─────────┘                                 │        │
│  └─────────────────────────┬───────────────────────────────────────        │
│                            │                                               │
└────────────────────────────┼───────────────────────────────────────────────┘
                             │
                             │ Payment Request Event
                             │ {amount, from, to, idempotency_key}
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            │          THE FORK               │
            │                                 │
┌───────────▼──────────┐         ┌────────────▼─────────┐
│                      │         │                      │
│   PATH A: HOT PATH   │         │  PATH B: COLD PATH   │
│   (< 100ms Response) │         │  (Eventual Accuracy) │
│                      │         │                      │
└──────────────────────┘         └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         PATH A: HOT PATH (REAL-TIME)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Event Streaming                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                      Tinybird                           │                │
│  │         (ClickHouse-as-a-Service API Layer)             │                │
│  │                                                         │                │
│  │    POST /events/transactions (Ingest Endpoint)          │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │ Write (async, fire-and-forget)                     │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                   ClickHouse                            │                │
│  │              (Columnar OLAP Database)                   │                │
│  │                                                         │                │
│  │  Tables:                                                │                │
│  │   • transaction_events (append-only log)                │                │
│  │   • user_velocity_features (aggregated)                 │                │
│  │   • fraud_scores_history                                │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│  Step 2: Feature Query (< 50ms)                                             │
│                        │                                                    │
│                        │ SELECT COUNT(*), SUM(amount)                       │
│                        │ FROM transaction_events                            │
│                        │ WHERE user_id = ? AND timestamp > now() - 1h       │
│                        │                                                    │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │              AI Fraud Detection Model                   │                │
│  │           (Python FastAPI or Rust Service)              │                │
│  │                                                         │                │
│  │  Input Features:                                        │                │
│  │   • Transaction velocity (last 1h, 24h, 7d)             │                │
│  │   • Amount deviation from user average                  │                │
│  │   • Geographic location change                          │                │
│  │   • Device fingerprint match                            │                │
│  │                                                         │                │
│  │  Output: Risk Score (0.0 - 1.0)                         │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │              Decision Engine                            │                │
│  │                                                         │                │
│  │  IF risk_score > 0.85: DENY                             │                │
│  │  ELIF risk_score > 0.60: REQUIRE_2FA                    │                │
│  │  ELSE: APPROVE                                          │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│                        │ Return to API Gateway (< 100ms total)              │
│                        │                                                    │
└────────────────────────┼────────────────────────────────────────────────────┘
                         │
                         │ Response: {approved: true, requires_2fa: false}
                         │
┌────────────────────────┼────────────────────────────────────────────────────┐
│                        │    PATH B: COLD PATH (LEDGER INTEGRITY)            │
├────────────────────────┼────────────────────────────────────────────────────┤
│                        │                                                    │
│  Step 1: Queue Event (Decoupling)                                           │
│                        │                                                    │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                     Redpanda                            │                │
│  │              (Kafka-compatible Queue)                   │                │
│  │                                                         │                │
│  │  Topic: financial.transactions.pending                  │                │
│  │  Partitions: 12 (sharded by user_id)                    │                │
│  │  Retention: 7 days                                      │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│  Step 2: Consumer Processing                                                │
│                        │ Poll messages (batch of 100)                       │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │              Background Worker                          │                │
│  │         (Node.js/Bun Consumer Service)                  │                │
│  │                                                         │                │
│  │  For each message:                                      │                │
│  │   1. Check Redis for duplicate idempotency_key          │                │
│  │   2. If exists: Skip (already processed)                │                │
│  │   3. If new: Process transaction                        │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│  Step 3: Ledger Write (ACID Transaction)                                    │
│                        │                                                    │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                  PostgreSQL                             │                │
│  │             (Transactional Database)                    │                │
│  │                                                         │                │
│  │  BEGIN TRANSACTION;                                     │                │
│  │                                                         │                │
│  │  -- Step 3a: Create transaction record                  │                │
│  │  INSERT INTO transactions                               │                │
│  │    (id, idempotency_key, type, status)                  │                │
│  │  VALUES (uuid, 'abc123', 'TRANSFER', 'PENDING');        │                │
│  │                                                         │                │
│  │  -- Step 3b: Lock sender's account (prevent race)       │                │
│  │  SELECT * FROM accounts                                 │                │
│  │  WHERE id = sender_account_id                           │                │
│  │  FOR UPDATE;  -- Exclusive lock                         │                │
│  │                                                         │                │
│  │  -- Step 3c: Validate balance                           │                │
│  │  IF balance_available < amount:                         │                │
│  │    ROLLBACK; RAISE 'Insufficient funds';                │                │
│  │                                                         │                │
│  │  -- Step 3d: Insert ledger entries (Double-Entry)       │                │
│  │  INSERT INTO ledger_entries                             │                │
│  │    (transaction_id, account_id, direction, amount)      │                │
│  │  VALUES                                                 │                │
│  │    (txn_id, sender_id, 'DEBIT', 5000),    -- $50.00     │                │
│  │    (txn_id, receiver_id, 'CREDIT', 5000);               │                │
│  │                                                         │                │
│  │  -- Step 3e: Update balances                            │                │
│  │  UPDATE accounts                                        │                │
│  │  SET balance_current = balance_current - 5000,          │                │
│  │      balance_available = balance_available - 5000       │                │
│  │  WHERE id = sender_id;                                  │                │
│  │                                                         │                │
│  │  UPDATE accounts                                        │                │
│  │  SET balance_current = balance_current + 5000,          │                │
│  │      balance_available = balance_available + 5000       │                │
│  │  WHERE id = receiver_id;                                │                │
│  │                                                         │                │
│  │  -- Step 3f: Mark transaction as complete               │                │
│  │  UPDATE transactions                                    │                │
│  │  SET status = 'POSTED'                                  │                │
│  │  WHERE id = txn_id;                                     │                │
│  │                                                         │                │
│  │  COMMIT;  -- All or nothing                             │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│  Step 4: Cache Success                                                      │
│                        │                                                    │
│                        ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                     Redis                               │                │
│  │                                                         │                │
│  │  SET idempotency:abc123 "PROCESSED" EX 86400            │                │
│  │  (24 hour TTL)                                          │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      VISUALIZATION LAYER (INTERNAL)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │              React Dashboard (Internal Team)            │                │
│  │                                                         │                │
│  │  Components:                                            │                │
│  │   • Real-time transaction monitor                       │                │
│  │   • Fraud alerts dashboard                              │                │
│  │   • User balance reconciliation                         │                │
│  │   • Audit log viewer                                    │                │
│  └─────────────────────┬───────────────────────────────────┘                │
│                        │                                                    │
│                        │ tRPC Queries (Type-safe)                           │
│                        │                                                    │
│         ┌──────────────┴──────────────┐                                     │
│         │                             │                                     │
│         ▼                             ▼                                     │
│  ┌──────────────┐              ┌─────────────┐                              │
│  │  PostgreSQL  │              │  ClickHouse │                              │
│  │              │              │             │                              │
│  │  Query:      │              │  Query:     │                              │
│  │  - Balances  │              │  - Analytics│                              │
│  │  - Ledger    │              │  - Trends   │                              │
│  └──────────────┘              │  - Velocity │                              │
│                                └─────────────┘                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### The Data Flow Summary

**1. Ingestion Phase**
   - External client (Bank/Fintech) sends payment request via OpenAPI endpoint
   - API Gateway (Fastify/Hono) receives and validates request
   - Redis checks idempotency key and rate limits

**2. The Fork - Parallel Processing**

   **Path A (The Hot Path < 100ms) - Real-time Decision:**
   - Event streamed to Tinybird (ClickHouse) immediately
   - AI Model queries ClickHouse for user velocity features
   - Risk scoring engine evaluates transaction
   - Returns APPROVE/DENY/REQUIRE_2FA to API Gateway
   - Client receives instant response

   **Path B (The Cold Path) - Ledger Integrity:**
   - Event queued in Redpanda for async processing
   - Background worker consumes message
   - Checks Redis for duplicate processing
   - Executes PostgreSQL ACID transaction:
     - Creates transaction record (PENDING)
     - Locks account rows (prevents race conditions)
     - Validates sufficient balance
     - Inserts double-entry ledger records
     - Updates account balances atomically
     - Marks transaction as POSTED
   - Caches idempotency key in Redis

**3. Visualization Layer**
   - Internal dashboard queries PostgreSQL for balances and ledger
   - Queries ClickHouse for analytics and trends
   - Real-time updates via tRPC subscriptions

---

## 2.1. Understanding the Fork: Hot Path vs Cold Path

### What is "The Fork"?

**The Fork is NOT a conditional statement** (if/else). Instead, it's a **parallel execution pattern** where BOTH paths run simultaneously:

- **Hot Path**: Runs synchronously and returns the response to the client (< 100ms)
- **Cold Path**: Runs asynchronously in the background (eventual consistency)

### Implementation in Backend Service

Here's how the fork is implemented in your Fastify/Hono backend:

```typescript
// File: src/routes/transfer.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { TransferSchema } from './schemas';
import { publishToKafka } from '../services/kafka';
import { sendToClickHouse } from '../services/clickhouse';
import { checkFraudScore } from '../services/fraud-detection';
import { checkIdempotency, setIdempotency } from '../services/cache';

export async function createTransferHandler(
  request: FastifyRequest<{ Body: TransferSchema }>,
  reply: FastifyReply
) {
  const { from, to, amount, idempotency_key } = request.body;

  // Step 1: Check idempotency (prevent duplicates)
  const alreadyProcessed = await checkIdempotency(idempotency_key);
  if (alreadyProcessed) {
    return reply.code(409).send({ error: 'Transaction already processed' });
  }

  // Step 2: Create event object
  const transferEvent = {
    id: generateUUID(),
    from,
    to,
    amount,
    idempotency_key,
    timestamp: new Date(),
    metadata: {
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    },
  };

  // ============================================================================
  // THE FORK: Both paths execute in parallel (non-blocking)
  // ============================================================================

  // COLD PATH (Fire-and-forget - Non-blocking)
  // This does NOT wait for Kafka to finish processing
  publishToKafka('financial.transactions.pending', transferEvent)
    .catch(err => {
      // Log error but don't block the response
      logger.error('Failed to publish to Kafka', err);
      // Kafka has retry logic and DLQ for failures
    });

  // HOT PATH (Synchronous - Blocking)
  // This WAITS for the fraud check before responding to client
  try {
    // Step 3a: Send event to ClickHouse (fire-and-forget, ~10ms)
    sendToClickHouse(transferEvent).catch(err => {
      logger.error('Failed to send to ClickHouse', err);
    });

    // Step 3b: Check fraud score (blocking, ~50-80ms)
    const fraudResult = await checkFraudScore({
      userId: from,
      amount,
      recipientId: to,
    });

    // Step 3c: Make decision based on fraud score
    if (fraudResult.score > 0.85) {
      return reply.code(403).send({
        approved: false,
        reason: 'High risk transaction',
        transaction_id: transferEvent.id,
      });
    }

    if (fraudResult.score > 0.60) {
      return reply.code(200).send({
        approved: true,
        requires_2fa: true,
        transaction_id: transferEvent.id,
      });
    }

    // Step 3d: Return success response (Cold path still running in background)
    return reply.code(200).send({
      approved: true,
      requires_2fa: false,
      transaction_id: transferEvent.id,
    });

  } catch (error) {
    logger.error('Hot path failed', error);
    return reply.code(500).send({ error: 'Fraud check failed' });
  }

  // At this point:
  // ✅ Client received response (~80ms)
  // ⏳ Kafka message is being processed by background worker (async)
  // ⏳ Worker will write to PostgreSQL in the next 50-500ms
}
```

### Why This Architecture?

```
┌─────────────────────────────────────────────────────────────────┐
│                     THE FORK EXPLAINED                          │
└─────────────────────────────────────────────────────────────────┘

Time: 0ms
│
│  Client sends POST /api/v1/transfer
│
▼
┌─────────────────────────────────────────────┐
│         API Gateway receives request        │
│         (Validates, checks rate limit)      │
└─────────────────┬───────────────────────────┘
                  │
Time: 10ms        │
                  │
                  ▼
         ┌────────────────────┐
         │    THE FORK        │
         │  (Both paths run)  │
         └────────┬───────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼

┌──────────────────┐    ┌─────────────────────┐
│   COLD PATH      │    │    HOT PATH         │
│   (Async)        │    │    (Sync)           │
│                  │    │                     │
│ publishToKafka() │    │ checkFraudScore()   │
│   .then(...)     │    │   await ...         │
│   .catch(...)    │    │                     │
│                  │    │ Query ClickHouse    │
│ ⚡ Non-blocking  │    │ AI Model scores     │
│ ⚡ Fire-and-     │    │ Return decision     │
│    forget        │    │                     │
│                  │    │ ⏱️ Client WAITS     │
│ Returns          │    │   for this          │
│ immediately      │    │                     │
└──────────────────┘    └─────────┬───────────┘
        │                         │
        │                         │
        │               Time: 80ms│
        │                         │
        │                         ▼
        │              ┌──────────────────────┐
        │              │  Response to Client  │
        │              │  {approved: true}    │
        │              └──────────────────────┘
        │
        │  Background worker
        │  polls Kafka (later)
        │
        ▼
┌────────────────────────┐
│  Kafka Queue           │
│  (Message waiting)     │
└────────┬───────────────┘
         │
Time: 100-500ms (async)
         │
         ▼
┌────────────────────────┐
│  Background Worker     │
│  Processes message     │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│  PostgreSQL            │
│  (Ledger update)       │
│  ACID transaction      │
└────────────────────────┘
```

### Key Points:

1. **Not an If/Else Decision**: Both paths ALWAYS execute
2. **Hot Path Blocks**: The API waits for fraud detection before responding
3. **Cold Path is Fire-and-Forget**: Kafka publish happens async, doesn't block response
4. **Client Gets Fast Response**: ~80ms (fraud check only)
5. **Ledger Updates Later**: Background worker processes in 100-500ms
6. **Eventual Consistency**: The "truth" (PostgreSQL) is eventually consistent with the decision (fraud check)

### What Happens in Each Path:

| Aspect | Hot Path | Cold Path |
|--------|----------|-----------|
| **Purpose** | Real-time fraud detection | Permanent ledger record |
| **Execution** | Synchronous (blocks response) | Asynchronous (background) |
| **Data Store** | ClickHouse (OLAP) | PostgreSQL (OLTP) |
| **Response Time** | < 100ms | 100-500ms (doesn't block) |
| **Consistency** | Eventual | Strong (ACID) |
| **Client Waits?** | ✅ Yes | ❌ No |
| **Can Fail Silently?** | ❌ No (returns error to client) | ✅ Yes (retries + DLQ) |

### Real-World Example:

```
User clicks "Send $50 to Alice"
         │
         ▼
┌────────────────────────────────────────────┐
│  Fastify receives request                  │
└────────┬───────────────────────────────────┘
         │
         │ THE FORK happens here
         │
    ┌────┴─────┐
    │          │
    ▼          ▼

publishToKafka(...)     +     await checkFraudScore(...)
  (doesn't wait)                  (waits for result)
         │                              │
         │                              │
         ▼                              ▼

  Kafka queue              ClickHouse queries user history
  stores message           AI model: "Score: 0.23 (low risk)"
         │                              │
         │                              │
         │                              ▼
         │
         │                       Return to client:
         │                       "✅ Approved! Transaction ID: abc123"
         │
         │                       [User sees success immediately]
         │
         ▼

  [5 seconds later...]

  Worker pulls message from Kafka
  Writes to PostgreSQL:
    - INSERT INTO transactions
    - INSERT INTO ledger_entries (DEBIT/CREDIT)
    - UPDATE accounts balances
  COMMIT transaction

  [Now the ledger reflects the transfer]
```

---

## 2.1.1. Critical Race Condition: Worker Processes Before Fraud Check

### The Problem

**What if the background worker processes the transaction BEFORE the fraud check completes?**

This is a real possibility because:
- Cold Path (Kafka → Worker → PostgreSQL) can complete in 50ms
- Hot Path (Fraud check) can take 80-100ms
- The worker might write to the ledger BEFORE fraud detection denies the transaction

```
Time: 0ms    Client sends transfer request
Time: 10ms   Fork happens → publishToKafka() + checkFraudScore()
Time: 15ms   Kafka receives message
Time: 20ms   Worker polls and gets message
Time: 70ms   Worker COMMITS to PostgreSQL ✅ (Money transferred!)
Time: 90ms   Fraud check returns: DENIED ❌ (Too late!)
Time: 95ms   Client receives: "Transaction denied"

Problem: Money already moved in ledger but client was told "denied"!
```

### Solution 1: Include Fraud Score in Kafka Message (Recommended)

**Don't publish to Kafka until fraud check completes.**

```typescript
// File: src/routes/transfer.ts (CORRECTED VERSION)

export async function createTransferHandler(
  request: FastifyRequest<{ Body: TransferSchema }>,
  reply: FastifyReply
) {
  const { from, to, amount, idempotency_key } = request.body;

  // Step 1: Check idempotency
  const alreadyProcessed = await checkIdempotency(idempotency_key);
  if (alreadyProcessed) {
    return reply.code(409).send({ error: 'Transaction already processed' });
  }

  // Step 2: Create event object
  const transferEvent = {
    id: generateUUID(),
    from,
    to,
    amount,
    idempotency_key,
    timestamp: new Date(),
  };

  // ============================================================================
  // CORRECTED FLOW: Fraud check FIRST, then publish to Kafka
  // ============================================================================

  try {
    // STEP 1: Send to ClickHouse (fire-and-forget)
    sendToClickHouse(transferEvent).catch(err => {
      logger.error('Failed to send to ClickHouse', err);
    });

    // STEP 2: HOT PATH - Check fraud score (BLOCKING)
    const fraudResult = await checkFraudScore({
      userId: from,
      amount,
      recipientId: to,
    });

    // STEP 3: Make decision
    if (fraudResult.score > 0.85) {
      // HIGH RISK - Do NOT publish to Kafka
      return reply.code(403).send({
        approved: false,
        reason: 'High risk transaction',
        transaction_id: transferEvent.id,
      });
    }

    // STEP 4: ONLY publish to Kafka if approved
    // Include fraud score in the message for audit trail
    const approvedEvent = {
      ...transferEvent,
      fraud_check: {
        score: fraudResult.score,
        decision: fraudResult.score > 0.60 ? 'REQUIRE_2FA' : 'APPROVED',
        checked_at: new Date(),
      },
      status: 'APPROVED', // Worker will only process APPROVED events
    };

    // COLD PATH - Publish AFTER approval (still async, but happens after decision)
    publishToKafka('financial.transactions.approved', approvedEvent)
      .catch(err => {
        logger.error('Failed to publish to Kafka', err);
        // Critical: Alert ops team - approved transaction not queued!
        alertOpsTeam('CRITICAL: Approved transaction not queued', {
          transaction_id: transferEvent.id,
          error: err,
        });
      });

    // STEP 5: Return response to client
    if (fraudResult.score > 0.60) {
      return reply.code(200).send({
        approved: true,
        requires_2fa: true,
        transaction_id: transferEvent.id,
      });
    }

    return reply.code(200).send({
      approved: true,
      requires_2fa: false,
      transaction_id: transferEvent.id,
    });

  } catch (error) {
    logger.error('Hot path failed', error);
    return reply.code(500).send({ error: 'Fraud check failed' });
  }
}
```

### Solution 2: Worker Validates Fraud Score Before Processing

**Worker checks fraud approval before writing to ledger.**

```typescript
// File: src/workers/transaction-processor.ts

import { KafkaMessage } from 'kafkajs';
import { processDatabaseTransaction } from '../services/ledger';

export async function processTransactionMessage(message: KafkaMessage) {
  const event = JSON.parse(message.value.toString());

  const {
    id,
    from,
    to,
    amount,
    idempotency_key,
    fraud_check,
    status
  } = event;

  // Step 1: Check idempotency (prevent duplicate processing)
  const alreadyProcessed = await checkIdempotency(idempotency_key);
  if (alreadyProcessed) {
    logger.info('Transaction already processed, skipping', { id });
    return; // Skip, already done
  }

  // ============================================================================
  // CRITICAL VALIDATION: Only process if fraud check approved
  // ============================================================================

  // Step 2: Validate fraud check exists
  if (!fraud_check || !fraud_check.decision) {
    logger.error('Missing fraud check in message', { id });
    // Move to DLQ for manual review
    await publishToDLQ('missing_fraud_check', event);
    return;
  }

  // Step 3: Validate transaction was approved
  if (status !== 'APPROVED') {
    logger.warn('Transaction not approved, skipping ledger write', {
      id,
      status,
      fraud_score: fraud_check.score
    });
    // Don't process denied transactions
    return;
  }

  // Step 4: Additional safety check - verify fraud score is acceptable
  if (fraud_check.score > 0.85) {
    logger.error('High fraud score in approved message - data inconsistency!', {
      id,
      fraud_score: fraud_check.score,
    });
    // Critical alert - this should never happen
    await alertOpsTeam('CRITICAL: High fraud score in approved queue', event);
    await publishToDLQ('fraud_score_mismatch', event);
    return;
  }

  // Step 5: Process the transaction (write to PostgreSQL)
  try {
    await processDatabaseTransaction({
      id,
      from,
      to,
      amount,
      idempotency_key,
      fraud_score: fraud_check.score,
    });

    // Step 6: Cache idempotency key
    await setIdempotency(idempotency_key, 'PROCESSED', 86400); // 24h TTL

    logger.info('Transaction processed successfully', { id });

  } catch (error) {
    logger.error('Failed to process transaction', { id, error });
    throw error; // Will trigger retry logic
  }
}
```

### Solution 3: Two-Phase Commit Pattern (Most Robust)

**Reserve funds first, then finalize after fraud check.**

```
┌─────────────────────────────────────────────────────────────────┐
│              TWO-PHASE COMMIT PATTERN                           │
└─────────────────────────────────────────────────────────────────┘

Phase 1: RESERVE (Immediate)
│
├─> Worker creates transaction with status = 'PENDING'
├─> Worker inserts ledger entries
├─> Worker updates balance_available (subtract amount)
├─> DOES NOT update balance_current (money not moved yet)
│
│   User's balance:
│   balance_current:   $1000 (unchanged)
│   balance_available: $950  (reserved $50)
│
└─> Commit

Phase 2: FINALIZE (After fraud check)
│
├─> If APPROVED:
│   ├─> Update transaction status = 'POSTED'
│   ├─> Update balance_current (move money)
│   └─> User's balance:
│       balance_current:   $950 (money moved)
│       balance_available: $950
│
└─> If DENIED:
    ├─> Update transaction status = 'REJECTED'
    ├─> Rollback balance_available (release hold)
    └─> User's balance:
        balance_current:   $1000 (unchanged)
        balance_available: $1000 (hold released)
```

**Implementation:**

```typescript
// File: src/services/ledger.ts

export async function reserveFunds(params: ReserveParams) {
  const { from, to, amount, transaction_id } = params;

  return await db.transaction(async (tx) => {
    // 1. Create transaction with PENDING status
    await tx.insert(transactions).values({
      id: transaction_id,
      type: 'TRANSFER',
      status: 'PENDING', // Not POSTED yet
      idempotency_key: params.idempotency_key,
    });

    // 2. Lock sender's account
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, from))
      .forUpdate();

    // 3. Validate sufficient funds
    if (account.balance_available < amount) {
      throw new Error('Insufficient funds');
    }

    // 4. Insert ledger entries (DEBIT/CREDIT)
    await tx.insert(ledgerEntries).values([
      {
        transaction_id,
        account_id: from,
        direction: 'DEBIT',
        amount,
        balance_after: account.balance_current, // Unchanged for now
      },
      {
        transaction_id,
        account_id: to,
        direction: 'CREDIT',
        amount,
        balance_after: null, // Will be set in Phase 2
      },
    ]);

    // 5. Update balance_available ONLY (create hold)
    await tx
      .update(accounts)
      .set({
        balance_available: sql`${accounts.balance_available} - ${amount}`,
      })
      .where(eq(accounts.id, from));

    // balance_current is NOT updated yet
  });
}

export async function finalizeFunds(params: FinalizeParams) {
  const { transaction_id, approved, fraud_score } = params;

  return await db.transaction(async (tx) => {
    // 1. Get transaction
    const [txn] = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction_id))
      .forUpdate();

    if (txn.status !== 'PENDING') {
      throw new Error('Transaction already finalized');
    }

    if (approved) {
      // APPROVED: Move money (update balance_current)
      const [senderEntry] = await tx
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.transaction_id, transaction_id),
            eq(ledgerEntries.direction, 'DEBIT')
          )
        );

      const [receiverEntry] = await tx
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.transaction_id, transaction_id),
            eq(ledgerEntries.direction, 'CREDIT')
          )
        );

      // Update sender's balance_current
      await tx
        .update(accounts)
        .set({
          balance_current: sql`${accounts.balance_current} - ${senderEntry.amount}`,
        })
        .where(eq(accounts.id, senderEntry.account_id));

      // Update receiver's balance_current AND balance_available
      await tx
        .update(accounts)
        .set({
          balance_current: sql`${accounts.balance_current} + ${receiverEntry.amount}`,
          balance_available: sql`${accounts.balance_available} + ${receiverEntry.amount}`,
        })
        .where(eq(accounts.id, receiverEntry.account_id));

      // Mark transaction as POSTED
      await tx
        .update(transactions)
        .set({
          status: 'POSTED',
          metadata: { fraud_score },
        })
        .where(eq(transactions.id, transaction_id));

    } else {
      // DENIED: Release hold (rollback balance_available)
      const [senderEntry] = await tx
        .select()
        .from(ledgerEntries)
        .where(
          and(
            eq(ledgerEntries.transaction_id, transaction_id),
            eq(ledgerEntries.direction, 'DEBIT')
          )
        );

      // Release the hold
      await tx
        .update(accounts)
        .set({
          balance_available: sql`${accounts.balance_available} + ${senderEntry.amount}`,
        })
        .where(eq(accounts.id, senderEntry.account_id));

      // Mark transaction as REJECTED
      await tx
        .update(transactions)
        .set({
          status: 'REJECTED',
          metadata: { fraud_score, reason: 'Fraud check failed' },
        })
        .where(eq(transactions.id, transaction_id));
    }
  });
}
```

### Comparison of Solutions

| Solution | Pros | Cons | Complexity |
|----------|------|------|------------|
| **1. Fraud Check Before Kafka** | Simple, prevents race condition | Slightly slower (fraud check blocks Kafka publish) | Low |
| **2. Worker Validates Status** | Worker has defense-in-depth | Requires fraud result in message | Medium |
| **3. Two-Phase Commit** | Most robust, allows holds | Complex, requires status management | High |

### Recommended Approach: **Combine Solutions 1 + 2**

```typescript
// API Handler (Solution 1)
const fraudResult = await checkFraudScore(...);
if (fraudResult.score > 0.85) {
  return reply.code(403).send({ approved: false });
}

// Only publish if approved
await publishToKafka('financial.transactions.approved', {
  ...event,
  fraud_check: fraudResult,
  status: 'APPROVED',
});

// Worker (Solution 2)
if (event.status !== 'APPROVED' || !event.fraud_check) {
  logger.warn('Skipping non-approved transaction');
  return;
}

await processDatabaseTransaction(event);
```

This ensures:
- ✅ Worker never processes denied transactions
- ✅ Fraud score is part of the audit trail
- ✅ No race condition possible
- ✅ Simple to implement and maintain

---

## 2.1.2. Two-Process Architecture: API Server vs Worker Process

### The Complete Picture

Yes! Eventually, your system runs **two separate processes**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TWO-PROCESS ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────┐      ┌─────────────────────────────┐
│     PROCESS 1: API SERVER      │      │  PROCESS 2: WORKER POOL     │
│     (Handles HTTP Requests)    │      │  (Processes Messages)       │
├────────────────────────────────┤      ├─────────────────────────────┤
│                                │      │                             │
│  Responsibilities:             │      │  Responsibilities:          │
│  • Accept HTTP requests        │      │  • Poll Kafka messages      │
│  • Validate input (Zod)        │      │  • Write to PostgreSQL      │
│  • Check idempotency (Redis)   │      │  • Handle retries           │
│  • Check fraud score           │      │  • Manage DLQ               │
│  • Publish to Kafka            │      │  • Cache idempotency        │
│  • Return HTTP response        │      │                             │
│                                │      │                             │
│  Does NOT touch PostgreSQL!    │      │  Does NOT handle HTTP!      │
│                                │      │                             │
│  Running on:                   │      │  Running on:                │
│  • Port 3000                   │      │  • Background process       │
│  • Multiple instances (scale)  │      │  • Multiple instances       │
│  • Kubernetes pods             │      │  • Kubernetes pods          │
│                                │      │                             │
└────────────┬───────────────────┘      └────────┬────────────────────┘
             │                                   │
             │  Communication via Kafka          │
             └───────────────┬───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Kafka/Redpanda │
                    │  (Message Queue)│
                    └─────────────────┘
```

### Process 1: API Server (Fastify/Hono)

**File Structure:**
```
src/
├── server.ts              # Entry point - starts Fastify
├── routes/
│   ├── transfer.ts        # POST /api/v1/transfer
│   ├── accounts.ts        # GET /api/v1/accounts/:id
│   └── health.ts          # GET /health
├── services/
│   ├── kafka-producer.ts  # Publishes messages to Kafka
│   ├── clickhouse.ts      # Sends events to ClickHouse
│   ├── fraud-detection.ts # Calls AI fraud model
│   └── cache.ts           # Redis operations
└── schemas/
    └── transfer.ts        # Zod validation schemas
```

**Entry Point:**
```typescript
// File: src/server.ts

import Fastify from 'fastify';
import { transferRoutes } from './routes/transfer';
import { accountRoutes } from './routes/accounts';

const server = Fastify({
  logger: true,
});

// Register routes
server.register(transferRoutes, { prefix: '/api/v1' });
server.register(accountRoutes, { prefix: '/api/v1' });

// Health check
server.get('/health', async () => {
  return { status: 'ok', service: 'api-server' };
});

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('API Server listening on port 3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

**What it does:**
1. ✅ Receives HTTP POST `/api/v1/transfer`
2. ✅ Validates request body (Zod schema)
3. ✅ Checks Redis for idempotency
4. ✅ Calls fraud detection service (ClickHouse + AI)
5. ✅ Publishes to Kafka topic: `financial.transactions.approved`
6. ✅ Returns HTTP 200/403 response
7. ❌ **NEVER writes to PostgreSQL directly**

---

### Process 2: Worker Process (Kafka Consumer)

**File Structure:**
```
src/
├── worker.ts                    # Entry point - starts Kafka consumer
├── workers/
│   ├── transaction-processor.ts # Processes transaction messages
│   └── webhook-sender.ts        # Sends webhooks to clients
├── services/
│   ├── kafka-consumer.ts        # Consumes messages from Kafka
│   ├── ledger.ts                # PostgreSQL operations
│   └── cache.ts                 # Redis operations
└── db/
    └── schema.ts                # Drizzle/Prisma schema
```

**Entry Point:**
```typescript
// File: src/worker.ts

import { Kafka } from 'kafkajs';
import { processTransactionMessage } from './workers/transaction-processor';

const kafka = new Kafka({
  clientId: 'transaction-worker',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({
  groupId: 'transaction-processors',
  maxBytesPerPartition: 1048576, // 1MB
});

const run = async () => {
  await consumer.connect();
  console.log('Worker connected to Kafka');

  // Subscribe to topic
  await consumer.subscribe({
    topic: 'financial.transactions.approved',
    fromBeginning: false,
  });

  // Process messages
  await consumer.run({
    eachBatchAutoResolve: false,
    eachBatch: async ({
      batch,
      resolveOffset,
      heartbeat,
      isRunning,
      isStale,
    }) => {
      for (const message of batch.messages) {
        if (!isRunning() || isStale()) break;

        try {
          // Process the transaction
          await processTransactionMessage(message);

          // Commit offset (acknowledge)
          resolveOffset(message.offset);

          // Send heartbeat to Kafka
          await heartbeat();

          console.log(`Processed message offset ${message.offset}`);
        } catch (error) {
          console.error('Failed to process message', error);
          // Don't commit offset - message will be retried
        }
      }
    },
  });
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await consumer.disconnect();
  process.exit(0);
});

run().catch(console.error);
```

**What it does:**
1. ✅ Polls Kafka for messages (batch of 100)
2. ✅ For each message:
   - Validates status === 'APPROVED'
   - Checks Redis idempotency
   - Starts PostgreSQL transaction
   - Locks accounts with `SELECT FOR UPDATE`
   - Inserts ledger entries
   - Updates balances
   - Commits transaction
   - Caches idempotency key
   - Commits Kafka offset
3. ❌ **NEVER handles HTTP requests**

---

### Communication Between Processes

```
┌──────────────────────────────────────────────────────────────────┐
│                    MESSAGE FLOW                                  │
└──────────────────────────────────────────────────────────────────┘

API Server (Process 1)               Worker (Process 2)
      │                                      │
      │  1. Receive HTTP POST                │
      │  2. Validate + Fraud Check           │
      │  3. Publish to Kafka                 │
      │                                      │
      │  ─────────────────────────────>      │
      │     Kafka Message:                   │
      │     {                                │
      │       id: "txn_123",                 │
      │       from: "acc_456",               │
      │       to: "acc_789",                 │
      │       amount: 5000,                  │
      │       status: "APPROVED",            │
      │       fraud_check: {...}             │
      │     }                                │
      │                                      │
      │                                      │  4. Poll messages
      │                                      │  5. Process message
      │                                      │  6. Write to PostgreSQL
      │                                      │  7. Commit offset
      │                                      │
      │  4. Return HTTP 200                  │
      │  (Client gets response)              │
      │                                      │
      ▼                                      ▼
   Response sent                      Transaction committed
   (~80ms)                            (~100-500ms later)
```

---

### Deployment: Running Both Processes

**Development (Local):**
```bash
# Terminal 1 - API Server
npm run dev:api
# Starts Fastify on port 3000

# Terminal 2 - Worker Process
npm run dev:worker
# Starts Kafka consumer
```

**package.json:**
```json
{
  "scripts": {
    "dev:api": "tsx watch src/server.ts",
    "dev:worker": "tsx watch src/worker.ts",
    "build": "tsc",
    "start:api": "node dist/server.js",
    "start:worker": "node dist/worker.js"
  }
}
```

**Production (Kubernetes):**
```yaml
# api-server-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 3  # Scale horizontally
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api-server
        image: your-registry/api-server:latest
        command: ["node", "dist/server.js"]
        ports:
        - containerPort: 3000
        env:
        - name: KAFKA_BROKERS
          value: "kafka:9092"
        - name: REDIS_URL
          value: "redis://redis:6379"
---
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: transaction-worker
spec:
  replicas: 5  # Scale based on Kafka lag
  selector:
    matchLabels:
      app: transaction-worker
  template:
    metadata:
      labels:
        app: transaction-worker
    spec:
      containers:
      - name: worker
        image: your-registry/worker:latest
        command: ["node", "dist/worker.js"]
        env:
        - name: KAFKA_BROKERS
          value: "kafka:9092"
        - name: POSTGRES_URL
          value: "postgresql://user:pass@postgres:5432/ledger"
        - name: REDIS_URL
          value: "redis://redis:6379"
```

---

### Scaling Strategy

| Process | Scale Based On | Metrics |
|---------|---------------|---------|
| **API Server** | HTTP traffic | Requests/sec, P99 latency |
| **Worker** | Kafka lag | Consumer lag, processing rate |

**Scaling Workers:**
```bash
# Check Kafka consumer lag
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group transaction-processors \
  --describe

# Output:
# TOPIC                              PARTITION  LAG
# financial.transactions.approved    0          1523
# financial.transactions.approved    1          1891
# financial.transactions.approved    2          1672

# If lag > 1000, add more workers
kubectl scale deployment transaction-worker --replicas=10
```

**Auto-scaling (HPA):**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-autoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: transaction-worker
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: kafka_consumer_lag
      target:
        type: AverageValue
        averageValue: "500"  # Scale up if lag > 500
```

---

### Why Two Processes?

| Reason | Benefit |
|--------|---------|
| **Separation of Concerns** | API handles user requests, Worker handles database |
| **Independent Scaling** | Scale API for traffic, Worker for throughput |
| **Fault Isolation** | API crash doesn't affect ledger processing |
| **Async Processing** | Client gets fast response, heavy work happens later |
| **Resource Optimization** | API: CPU-bound, Worker: I/O-bound (different requirements) |

---

### Summary

```
Process 1 (API Server):
├─ Handles: HTTP requests
├─ Validates: Input, idempotency, fraud
├─ Publishes: Kafka messages
├─ Returns: HTTP responses
└─ Never touches: PostgreSQL

Process 2 (Worker):
├─ Consumes: Kafka messages
├─ Writes: PostgreSQL (ledger)
├─ Handles: Retries, DLQ
├─ Caches: Idempotency keys
└─ Never handles: HTTP requests

Communication: Via Kafka message queue
```

This is the **core of the architecture**: One process for speed (API), one for reliability (Worker).

---

## 2.1.3. How Clients Check Transaction Status (Long Polling, WebSocket, Webhooks)

### The Problem

After the API returns `HTTP 200 { approved: true, transaction_id: "txn_123" }`, the client needs to know:
- ✅ When the ledger is updated (Cold Path completes)
- ✅ The final transaction status (POSTED, FAILED, etc.)
- ✅ The updated account balance

**Timeline:**
```
Time: 0ms     Client sends POST /transfer
Time: 80ms    API returns: { approved: true, transaction_id: "txn_123" }
              ❓ At this point, money is NOT in the ledger yet!

Time: 200ms   Worker writes to PostgreSQL (ledger updated)
              ✅ NOW the transaction is finalized

Question: How does the client know when this happens?
```

---

### Solution 1: WebSocket (Real-time Updates) - RECOMMENDED

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                  WEBSOCKET ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────┘

Client                 WebSocket Server         Worker Process
(Browser/App)          (Socket.io/uWS)         (Kafka Consumer)
      │                      │                        │
      │  1. Connect WS       │                        │
      │─────────────────────>│                        │
      │  ws://api/events     │                        │
      │  ?userId=user_123    │                        │
      │                      │                        │
      │  2. POST /transfer   │                        │
      │─────────────────────>│                        │
      │                      │                        │
      │  3. HTTP 200         │                        │
      │  { transaction_id }  │                        │
      │<─────────────────────│                        │
      │                      │                        │
      │  Client waits...     │                        │
      │                      │                        │
      │                      │  4. Worker processes   │
      │                      │<───────────────────────│
      │                      │  Publishes to Redis    │
      │                      │  channel: "txn_123"    │
      │                      │                        │
      │  5. WS push event    │                        │
      │<─────────────────────│                        │
      │  {                   │                        │
      │    type: "POSTED",   │                        │
      │    transaction_id,   │                        │
      │    balance: 95000    │                        │
      │  }                   │                        │
      │                      │                        │
      ▼                      ▼                        ▼
```

**Implementation:**

**WebSocket Server:**
```typescript
// File: src/websocket-server.ts

import { Server } from 'socket.io';
import { createServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'https://yourdomain.com',
    credentials: true,
  },
});

// Redis Pub/Sub for multi-instance support
const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
});

// Connection handler
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId as string;

  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log(`User ${userId} connected via WebSocket`);

  // Join user-specific room
  socket.join(`user:${userId}`);

  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
  });
});

// Listen to Redis Pub/Sub for transaction updates
const subscriber = createClient({ url: 'redis://localhost:6379' });
await subscriber.connect();

subscriber.subscribe('transaction_updates', (message) => {
  const event = JSON.parse(message);
  const { user_id, transaction_id, status, balance } = event;

  // Push to specific user's WebSocket connection
  io.to(`user:${user_id}`).emit('transaction:updated', {
    transaction_id,
    status,
    balance,
    timestamp: new Date(),
  });

  console.log(`Pushed update to user ${user_id}:`, event);
});

httpServer.listen(3001, () => {
  console.log('WebSocket server listening on port 3001');
});
```

**Worker Publishes Updates:**
```typescript
// File: src/workers/transaction-processor.ts

import { createClient } from 'redis';

const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();

export async function processTransactionMessage(message: KafkaMessage) {
  const event = JSON.parse(message.value.toString());

  // ... process transaction in PostgreSQL ...

  try {
    await processDatabaseTransaction(event);

    // ============================================================
    // PUBLISH UPDATE TO WEBSOCKET SERVER VIA REDIS PUB/SUB
    // ============================================================
    await redis.publish('transaction_updates', JSON.stringify({
      user_id: event.from,
      transaction_id: event.id,
      status: 'POSTED',
      balance: updatedBalance,
      timestamp: new Date(),
    }));

    console.log(`Published transaction update for ${event.id}`);

  } catch (error) {
    // On failure, publish error status
    await redis.publish('transaction_updates', JSON.stringify({
      user_id: event.from,
      transaction_id: event.id,
      status: 'FAILED',
      error: error.message,
      timestamp: new Date(),
    }));
  }
}
```

**Client Code (React):**
```typescript
// File: frontend/src/hooks/useTransactionStatus.ts

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useTransactionStatus(userId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [updates, setUpdates] = useState<TransactionUpdate[]>([]);

  useEffect(() => {
    // Connect to WebSocket server
    const ws = io('ws://localhost:3001', {
      query: { userId },
      transports: ['websocket'],
    });

    ws.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    // Listen for transaction updates
    ws.on('transaction:updated', (data) => {
      console.log('Transaction update received:', data);
      setUpdates((prev) => [...prev, data]);

      // Show notification
      toast.success(`Transaction ${data.transaction_id} is now ${data.status}`);
    });

    ws.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [userId]);

  return { socket, updates };
}

// Usage in component
function TransferPage() {
  const { updates } = useTransactionStatus('user_123');

  const handleTransfer = async () => {
    const response = await fetch('/api/v1/transfer', {
      method: 'POST',
      body: JSON.stringify({ from, to, amount }),
    });

    const { transaction_id } = await response.json();

    // Show pending state
    toast.info(`Transaction ${transaction_id} approved, processing...`);

    // WebSocket will automatically notify when it's finalized
    // No need to poll!
  };

  return (
    <div>
      <button onClick={handleTransfer}>Send Money</button>

      {/* Real-time updates */}
      {updates.map((update) => (
        <div key={update.transaction_id}>
          {update.status === 'POSTED' ? '✅' : '❌'} {update.transaction_id}
        </div>
      ))}
    </div>
  );
}
```

---

### Solution 2: Server-Sent Events (SSE) - Simpler Alternative

**Simpler than WebSocket, unidirectional (server → client).**

```typescript
// File: src/routes/events.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from 'redis';

export async function eventsHandler(
  request: FastifyRequest<{ Querystring: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.query;

  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Subscribe to Redis for this user's updates
  const redis = createClient({ url: 'redis://localhost:6379' });
  await redis.connect();

  await redis.subscribe(`user:${userId}:updates`, (message) => {
    const data = JSON.parse(message);

    // Send SSE event
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  // Keep connection alive
  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup on disconnect
  request.raw.on('close', () => {
    clearInterval(heartbeat);
    redis.quit();
  });
}

// Register route
server.get('/api/v1/events', eventsHandler);
```

**Client (React):**
```typescript
useEffect(() => {
  const eventSource = new EventSource(`/api/v1/events?userId=user_123`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Transaction update:', data);
    setTransactionStatus(data.status);
  };

  return () => eventSource.close();
}, []);
```

---

### Solution 3: Polling (Simple, but Inefficient)

**Client repeatedly calls API to check status.**

```typescript
// File: src/routes/transactions.ts

export async function getTransactionStatus(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = request.params;

  // Query PostgreSQL for transaction status
  const transaction = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  if (!transaction) {
    return reply.code(404).send({ error: 'Transaction not found' });
  }

  return {
    id: transaction.id,
    status: transaction.status, // PENDING, POSTED, FAILED
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
  };
}

// Route
server.get('/api/v1/transactions/:id', getTransactionStatus);
```

**Client (React):**
```typescript
function useTransactionPolling(transactionId: string) {
  const [status, setStatus] = useState('PENDING');

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/transactions/${transactionId}`);
      const data = await response.json();

      setStatus(data.status);

      // Stop polling when finalized
      if (data.status !== 'PENDING') {
        clearInterval(interval);
      }
    }, 1000); // Poll every 1 second

    return () => clearInterval(interval);
  }, [transactionId]);

  return status;
}
```

---

### Solution 4: Webhooks (For External Clients)

**For bank/fintech integrations, push updates to their endpoints.**

```typescript
// File: src/workers/webhook-sender.ts

export async function sendWebhook(event: TransactionEvent) {
  const { user_id, transaction_id, status } = event;

  // Get user's webhook URL from database
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, user_id))
    .limit(1);

  if (!user.webhook_url) {
    return; // No webhook configured
  }

  // Send POST request to client's webhook endpoint
  try {
    await fetch(user.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': generateSignature(event),
      },
      body: JSON.stringify({
        event: 'transaction.updated',
        data: {
          transaction_id,
          status,
          timestamp: new Date(),
        },
      }),
    });

    console.log(`Webhook sent to ${user.webhook_url}`);
  } catch (error) {
    console.error('Webhook failed:', error);
    // Store in DLQ for retry
  }
}
```

**Worker publishes webhook event:**
```typescript
// After processing transaction
await processDatabaseTransaction(event);

// Publish to webhook queue
await publishToKafka('webhooks.transaction.updated', {
  user_id: event.from,
  transaction_id: event.id,
  status: 'POSTED',
});
```

---

### Comparison of Solutions

| Solution | Pros | Cons | Best For |
|----------|------|------|----------|
| **WebSocket** | Real-time, bidirectional | Complex infrastructure, scaling | Consumer apps (mobile/web) |
| **SSE** | Simple, built-in browser support | Unidirectional only | Real-time dashboards |
| **Polling** | Simple, no special infrastructure | Inefficient, delayed updates | Simple apps, low traffic |
| **Webhooks** | Reliable, async | Client must host endpoint | B2B integrations (banks) |

---

### Recommended Architecture: **WebSocket + Webhooks**

```
┌─────────────────────────────────────────────────────────────────┐
│                  COMPLETE NOTIFICATION SYSTEM                   │
└─────────────────────────────────────────────────────────────────┘

                          Worker Process
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
          Redis Pub/Sub              Kafka Topic
       "transaction_updates"      "webhooks.queue"
                    │                       │
                    │                       │
                    ▼                       ▼
          WebSocket Server           Webhook Worker
                    │                       │
                    │                       │
                    ▼                       ▼
         Consumer Clients            External Clients
       (Browser/Mobile App)          (Banks/Fintechs)
```

**For Internal Users (Dashboard):** Use WebSocket for real-time updates

**For External Partners (Banks):** Use Webhooks for async notifications

**Fallback:** Provide polling endpoint (`GET /transactions/:id`) for clients without WebSocket support

---

### Summary

**The Flow:**
1. Client sends POST `/transfer` → Gets `transaction_id` (~80ms)
2. Client connects to WebSocket → Subscribes to updates
3. Worker finishes processing → Publishes to Redis Pub/Sub
4. WebSocket server receives Redis message → Pushes to client
5. Client receives real-time update: `{ status: "POSTED", balance: 95000 }`

**No polling needed! Real-time, efficient, scalable.**

---

## 2.2. Detailed Component Interaction Diagram

This diagram shows the precise sequence of interactions between all system components, including timing, caching, and worker processes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETAILED REQUEST FLOW WITH TIMING                         │
└─────────────────────────────────────────────────────────────────────────────┘

External Client                API Gateway           Redis Cache        Kafka/Redpanda
(Bank/Fintech)            (Fastify/Hono Server)    (Cache Layer)      (Message Queue)
      │                            │                      │                   │
      │                            │                      │                   │
      │  POST /api/v1/transfer     │                      │                   │
      │  {                         │                      │                   │
      │    from: "acc_123",        │                      │                   │
      │    to: "acc_456",          │                      │                   │
      │    amount: 5000,           │                      │                   │
      │    idempotency_key: "xyz"  │                      │                   │
      │  }                         │                      │                   │
      ├───────────────────────────>│                      │                   │
      │                            │                      │                   │
      │                     ┌──────┴──────┐               │                   │
      │                     │ [1ms] Parse │               │                   │
      │                     │ & Validate  │               │                   │
      │                     └──────┬──────┘               │                   │
      │                            │                      │                   │
      │                            │  GET idempotency:xyz │                   │
      │                            ├─────────────────────>│                   │
      │                            │  [2ms] Check cache   │                   │
      │                            │<─────────────────────┤                   │
      │                            │  null (not found)    │                   │
      │                            │                      │                   │
      │                            │  INCR rate_limit:    │                   │
      │                            │    acc_123:minute    │                   │
      │                            ├─────────────────────>│                   │
      │                            │  [1ms] Increment     │                   │
      │                            │<─────────────────────┤                   │
      │                            │  count: 5 (< 100 OK) │                   │
      │                            │                      │                   │
      │                     ┌──────┴──────┐               │                   │
      │                     │ [3ms] Create│               │                   │
      │                     │ Event Object│               │                   │
      │                     └──────┬──────┘               │                   │
      │                            │                      │                   │
      │          ┌─────────────────┴─────────────────┐    │                   │
      │          │   FORK: HOT PATH + COLD PATH      │    │                   │
      │          └─────────────────┬─────────────────┘    │                   │
      │                            │                      │                   │
      │          ┌─────────────────┼──────────────────────┼──────────┐        │
      │          │                 │                      │          │        │
      │          ▼                 │                      │          ▼        │
      │                            │                      │                   │
┌─────┴──────────────────┐         │                      │    ┌──────────────┴────┐
│   HOT PATH FORK        │         │                      │    │  COLD PATH FORK   │
│   (Async)              │         │                      │    │  (Async)          │
└─────┬──────────────────┘         │                      │    └──────────────┬────┘
      │                            │                      │                   │
      │                            │                      │  PUBLISH to topic │
      │                            │                      │  "transactions"   │
      │                            │                      │<──────────────────┤
      │                            │                      │  [5ms] Queue msg  │
      │                            │                      │  ack: success     │
      │                            │                      │                   │
      ▼                            │                      │                   │
                                   │                      │                   │
Tinybird/ClickHouse                │                      │              Background
(OLAP Engine)                      │                      │              Worker Pool
      │                            │                      │              (Consumers)
      │  POST /events/ingest       │                      │                   │
      │  [10ms] Write to           │                      │                   │
      │  transaction_events        │                      │      ┌────────────▼─────┐
      │  (fire-and-forget)         │                      │      │ POLL messages    │
      │                            │                      │      │ (batch: 100)     │
      ▼                            │                      │      │ [50ms interval]  │
┌──────────────────┐               │                      │      └────────────┬─────┘
│   ClickHouse     │               │                      │                   │
│   Tables:        │               │                      │      ┌────────────▼─────┐
│                  │               │                      │      │ For each msg:    │
│ • transaction_   │               │                      │      │ idempotency_key  │
│   events         │               │                      │      └────────────┬─────┘
│ • user_velocity_ │               │                      │                   │
│   features       │               │                      │   Check Redis cache
│                  │               │                      │   for duplicates
└──────────┬───────┘               │                      │                   │
           │                       │                      │<──────────────────┤
           │ Query features        │                      │  GET idempotency: │
           │ (User velocity)       │                      │      xyz          │
           │ [20ms] Aggregation    │                      │  [2ms]            │
           │                       │                      │───────────────────>
           ▼                       │                      │  null (not cached)│
                                   │                      │                   │
┌──────────────────┐               │                      │                   │
│  AI Fraud Model  │               │                      │                   ▼
│  (FastAPI/Rust)  │               │                      │
│                  │               │                      │            PostgreSQL
│  Input:          │               │                      │           (OLTP Database)
│  • velocity_1h   │               │                      │                   │
│  • velocity_24h  │               │                      │    BEGIN TRANSACTION;
│  • avg_amount    │               │                      │                   │
│  • geo_change    │               │                      │    [5ms] INSERT   │
│                  │               │                      │    INTO           │
│  [30ms] Score:   │               │                      │    transactions   │
│  0.23 (LOW RISK) │               │                      │    STATUS=PENDING │
│                  │               │                      │                   │
└──────────┬───────┘               │                      │    [10ms] SELECT  │
           │                       │                      │    FROM accounts  │
           │ Return decision       │                      │    WHERE id=acc123│
           └──────────────────────>│                      │    FOR UPDATE;    │
                            [50ms] │                      │    (ROW LOCK)     │
                     ┌──────┴──────┐                      │                   │
                     │ Decision:   │                      │    [2ms] Validate │
                     │ APPROVED    │                      │    balance >= 5000│
                     └──────┬──────┘                      │                   │
      │                     │                             │    [8ms] INSERT   │
      │  HTTP 200 OK        │                             │    ledger_entries │
      │  {                  │                             │    (2 rows)       │
      │   approved: true,   │                             │                   │
      │   transaction_id,   │                             │    [5ms] UPDATE   │
      │   requires_2fa: false                             │    accounts       │
      │  }                  │                             │    SET balance    │
      │<────────────────────┤                             │    (2 accounts)   │
      │  [Total: ~80ms]     │                             │                   │
      │                     │                             │    [3ms] UPDATE   │
      │                     │                             │    transactions   │
      │                     │                             │    STATUS=POSTED  │
      │                     │                             │                   │
      │                     │                             │    COMMIT;        │
      │                     │                             │    [Total: 50ms]  │
      │                     │                             │                   │
      │                     │                             │                   │
      │                     │      SET idempotency:xyz    │                   │
      │                     │      "PROCESSED" EX 86400   │                   │
      │                     │      (24h TTL)              │                   │
      │                     │<────────────────────────────┤                   │
      │                     │      [2ms] Cache result     │                   │
      │                     │                             │                   │
      │                     │                             │                   │
      │                     │      PUBLISH to topic       │                   │
      │                     │      "transaction.completed"│                   │
      │                     │      (for webhooks)         │                   │
      │                     │─────────────────────────────>                   │
      │                     │      [3ms] Queue event      │                   │
      ▼                     ▼                             ▼                   ▼


┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKER PROCESS DETAIL (COLD PATH)                         │
└─────────────────────────────────────────────────────────────────────────────┘

Background Worker          Redis Cache         PostgreSQL         Kafka/Redpanda
   (Consumer)             (Idempotency)       (Ledger DB)        (Message Queue)
       │                       │                    │                   │
       │                       │                    │                   │
       │  POLL messages        │                    │                   │
       │  (batch size: 100)    │                    │                   │
       │<──────────────────────┼────────────────────┼───────────────────┤
       │  [50ms] Receive batch │                    │                   │
       │  of 100 messages      │                    │                   │
       │                       │                    │                   │
   ┌───▼────────────────────┐  │                    │                   │
   │ Message 1:             │  │                    │                   │
   │ {                      │  │                    │                   │
   │   id: "msg_001",       │  │                    │                   │
   │   idempotency_key: "k1"│  │                    │                   │
   │   payload: {...}       │  │                    │                   │
   │ }                      │  │                    │                   │
   └───┬────────────────────┘  │                    │                   │
       │                       │                    │                   │
       │  GET idempotency:k1   │                    │                   │
       ├──────────────────────>│                    │                   │
       │  [2ms] Check cache    │                    │                   │
       │<──────────────────────┤                    │                   │
       │  null (not processed) │                    │                   │
       │                       │                    │                   │
       │  BEGIN TRANSACTION    │                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [5ms] TX START    │                   │
       │                       │                    │                   │
       │  INSERT transactions  │                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [8ms] Write       │                   │
       │                       │                    │                   │
       │  SELECT accounts      │                    │                   │
       │  FOR UPDATE           │                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [10ms] Row lock   │                   │
       │<──────────────────────┼────────────────────┤                   │
       │  {balance: 100000}    │                    │                   │
       │                       │                    │                   │
   ┌───▼────────────────────┐  │                    │                   │
   │ Validate:              │  │                    │                   │
   │ balance >= amount?     │  │                    │                   │
   │ 100000 >= 5000 ✓       │  │                    │                   │
   └───┬────────────────────┘  │                    │                   │
       │                       │                    │                   │
       │  INSERT ledger_entries│                    │                   │
       │  (2 rows: DEBIT,CREDIT)                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [12ms] Write      │                   │
       │                       │                    │                   │
       │  UPDATE accounts      │                    │                   │
       │  SET balance = balance│                    │                   │
       │  +/- amount           │                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [8ms] Update      │                   │
       │                       │                    │                   │
       │  UPDATE transactions  │                    │                   │
       │  SET status='POSTED'  │                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [5ms] Update      │                   │
       │                       │                    │                   │
       │  COMMIT               │                    │                   │
       │───────────────────────┼───────────────────>│                   │
       │                       │  [3ms] Commit      │                   │
       │<──────────────────────┼────────────────────┤                   │
       │  SUCCESS              │  [Total: 50ms]     │                   │
       │                       │                    │                   │
       │  SET idempotency:k1   │                    │                   │
       │  "PROCESSED" EX 86400 │                    │                   │
       │──────────────────────>│                    │                   │
       │  [2ms] Cache success  │                    │                   │
       │                       │                    │                   │
       │  COMMIT offset        │                    │                   │
       │  (acknowledge msg)    │                    │                   │
       │───────────────────────┼────────────────────┼──────────────────>│
       │                       │                    │  [2ms] Commit     │
       │                       │                    │                   │
   ┌───▼────────────────────┐  │                    │                   │
   │ Process Message 2      │  │                    │                   │
   │ (repeat cycle)         │  │                    │                   │
   └───┬────────────────────┘  │                    │                   │
       │                       │                    │                   │
       ▼                       ▼                    ▼                   ▼


┌─────────────────────────────────────────────────────────────────────────────┐
│                 RETRY & ERROR HANDLING (WORKER)                              │
└─────────────────────────────────────────────────────────────────────────────┘

Worker Process                Redis Cache         PostgreSQL       Dead Letter Queue
      │                            │                    │                 (DLQ)
      │  Process message           │                    │                   │
      │                            │                    │                   │
      │  BEGIN TRANSACTION         │                    │                   │
      │────────────────────────────┼───────────────────>│                   │
      │                            │  Database error!   │                   │
      │                            │  Connection timeout│                   │
      │<───────────────────────────┼────────────────────┤                   │
      │  ERROR                     │                    │                   │
      │                            │                    │                   │
  ┌───▼────────────────┐           │                    │                   │
  │ Retry Logic:       │           │                    │                   │
  │ Attempt: 1/3       │           │                    │                   │
  │ Backoff: 2^1 = 2s  │           │                    │                   │
  └───┬────────────────┘           │                    │                   │
      │  [Wait 2 seconds]          │                    │                   │
      │                            │                    │                   │
      │  BEGIN TRANSACTION (retry) │                    │                   │
      │────────────────────────────┼───────────────────>│                   │
      │                            │  Still failing!    │                   │
      │<───────────────────────────┼────────────────────┤                   │
      │  ERROR                     │                    │                   │
      │                            │                    │                   │
  ┌───▼────────────────┐           │                    │                   │
  │ Retry Logic:       │           │                    │                   │
  │ Attempt: 2/3       │           │                    │                   │
  │ Backoff: 2^2 = 4s  │           │                    │                   │
  └───┬────────────────┘           │                    │                   │
      │  [Wait 4 seconds]          │                    │                   │
      │                            │                    │                   │
      │  BEGIN TRANSACTION (retry) │                    │                   │
      │────────────────────────────┼───────────────────>│                   │
      │                            │  Still failing!    │                   │
      │<───────────────────────────┼────────────────────┤                   │
      │  ERROR                     │                    │                   │
      │                            │                    │                   │
  ┌───▼────────────────┐           │                    │                   │
  │ Retry Logic:       │           │                    │                   │
  │ Attempt: 3/3       │           │                    │                   │
  │ Backoff: 2^3 = 8s  │           │                    │                   │
  └───┬────────────────┘           │                    │                   │
      │  [Wait 8 seconds]          │                    │                   │
      │                            │                    │                   │
      │  BEGIN TRANSACTION (retry) │                    │                   │
      │────────────────────────────┼───────────────────>│                   │
      │                            │  Still failing!    │                   │
      │<───────────────────────────┼────────────────────┤                   │
      │  MAX RETRIES EXCEEDED      │                    │                   │
      │                            │                    │                   │
  ┌───▼──────────────────────┐     │                    │                   │
  │ Move to Dead Letter Queue│     │                    │                   │
  │ + Alert Ops Team         │     │                    │                   │
  └───┬──────────────────────┘     │                    │                   │
      │                            │                    │                   │
      │  PUBLISH to DLQ topic      │                    │                   │
      │────────────────────────────┼────────────────────┼──────────────────>│
      │  {                         │                    │   [Store for      │
      │    original_message,       │                    │    manual review] │
      │    error: "DB timeout",    │                    │                   │
      │    retries: 3,             │                    │                   │
      │    timestamp               │                    │                   │
      │  }                         │                    │                   │
      │                            │                    │                   │
      │  Send alert to PagerDuty   │                    │                   │
      │  or Slack                  │                    │                   │
      │                            │                    │                   │
      ▼                            ▼                    ▼                   ▼


┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHING STRATEGY DETAILS                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Redis Cache Keys:

1. Idempotency Cache:
   Key Pattern: idempotency:{key}
   Value: "PROCESSED" | "PENDING"
   TTL: 24 hours (86400 seconds)
   Purpose: Prevent duplicate processing

2. Rate Limiting:
   Key Pattern: rate_limit:{account_id}:{window}
   Value: counter (integer)
   TTL: 60 seconds (minute), 3600 (hour)
   Purpose: Prevent abuse (e.g., max 100 requests/minute)

3. User Session:
   Key Pattern: session:{user_id}
   Value: JWT token data (JSON)
   TTL: 15 minutes (900 seconds)
   Purpose: Authentication cache

4. Balance Cache (Read-through):
   Key Pattern: balance:{account_id}
   Value: {current: 100000, available: 95000}
   TTL: 5 seconds
   Purpose: Reduce DB reads for high-traffic accounts
   Note: Invalidated on every write

5. Fraud Score Cache:
   Key Pattern: fraud_score:{transaction_id}
   Value: {score: 0.23, decision: "APPROVED"}
   TTL: 1 hour
   Purpose: Avoid re-scoring same transaction
```

### Component Interaction Summary

**Phase 1: Request Ingestion (0-10ms)**
1. Client sends POST request to API Gateway
2. Fastify/Hono validates request schema
3. Redis checks idempotency key (prevent duplicates)
4. Redis increments rate limiter (prevent abuse)

**Phase 2: The Fork (10-15ms)**
5. Event published to Kafka/Redpanda (async, non-blocking)
6. Event sent to Tinybird/ClickHouse (fire-and-forget)

**Phase 3: Hot Path - Fraud Detection (15-80ms)**
7. ClickHouse stores event in `transaction_events` table
8. AI model queries ClickHouse for user velocity features
9. Fraud scoring engine evaluates risk (0.0-1.0)
10. Decision engine returns APPROVE/DENY/REQUIRE_2FA
11. Response sent back to client (total ~80ms)

**Phase 4: Cold Path - Ledger Processing (Async, ~50-100ms)**
12. Background worker polls Kafka for messages (batch: 100)
13. For each message:
    - Check Redis idempotency cache
    - If cached: skip (already processed)
    - If new: start PostgreSQL transaction
14. PostgreSQL ACID transaction:
    - Insert into `transactions` (PENDING)
    - Lock `accounts` rows with `SELECT FOR UPDATE`
    - Validate sufficient balance
    - Insert two `ledger_entries` (DEBIT + CREDIT)
    - Update `accounts` balances atomically
    - Update `transactions` status to POSTED
    - Commit (all-or-nothing)
15. Cache idempotency key in Redis (24h TTL)
16. Commit Kafka offset (acknowledge processing)

**Phase 5: Error Handling**
- If PostgreSQL transaction fails:
  - Retry with exponential backoff (2s, 4s, 8s)
  - After 3 failed attempts: move to Dead Letter Queue
  - Alert ops team via PagerDuty/Slack
  - Manual investigation required

**Caching Strategy**
- **Idempotency**: 24-hour TTL prevents duplicate processing
- **Rate Limiting**: Per-minute/hour counters prevent abuse
- **Balance Cache**: 5-second TTL reduces DB load (invalidated on writes)
- **Fraud Scores**: 1-hour TTL avoids re-computation

---

## 3. Domain Knowledge (Fintech Fundamentals)

To build this correctly, you must understand the rules of money movement.

### Double-Entry Accounting

**Concept**: Money is never "created" or "destroyed," only moved. Every transaction has at least two entries: a Debit (money leaving) and a Credit (money entering).

**Equation**: Assets = Liabilities + Equity

**Why**: If your DB crashes mid-transaction, double-entry ensures you can reconstruct the state perfectly.

### Idempotency

**Concept**: Applying the same operation multiple times has the same effect as applying it once.

**Why**: Networks fail. If a payment gateway sends you a "Charge User $50" webhook twice by mistake, your system must process it only once. You need `idempotency_keys`.

### Race Conditions (Concurrency)

**Concept**: Two requests try to spend the same balance at the exact same millisecond.

**Solution**: You cannot read a balance in code and then write the new balance. You must use database-level locking (e.g., `SELECT FOR UPDATE`) or atomic increments (`UPDATE accounts SET balance = balance - 50 WHERE id = 1`).

### ISO 20022

**Concept**: The global standard for messaging between financial institutions.

**Why**: If you plan to integrate with banks, your data structures should loosely map to this standard (rich data, structured remittance info).

## 4. Possible Relational Database Tables (PostgreSQL)

While ClickHouse handles the massive stream of events, PostgreSQL handles the absolute truth. Here is a simplified schema focused on the Ledger.

**Note**: Use BigInt (store cents/satoshis) for all monetary values. Never use Float.

### A. accounts (The Entities)

Stores the "state" of a wallet or user.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency VARCHAR(3) NOT NULL, -- USD, VND, EUR
  balance_current BIGINT NOT NULL DEFAULT 0, -- The cached balance (cents)
  balance_available BIGINT NOT NULL DEFAULT 0, -- Balance minus holds
  version INT NOT NULL DEFAULT 1, -- For Optimistic Locking
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### B. transactions (The Intent)

Stores the high-level metadata of a transfer request.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id VARCHAR(255) UNIQUE, -- External ID (e.g. from Stripe)
  idempotency_key VARCHAR(255) UNIQUE, -- Crucial for preventing duplicates
  type VARCHAR(50) NOT NULL, -- DEPOSIT, TRANSFER, WITHDRAWAL
  status VARCHAR(20) NOT NULL, -- PENDING, POSTED, FAILED
  metadata JSONB, -- Context (IP address, Device ID)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### C. ledger_entries (The Immutable Log)

This is the most important table. It links back to transactions. The sum of all `amount` for a specific `account_id` must always equal the `balance_current` in the `accounts` table.

```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  account_id UUID REFERENCES accounts(id),
  direction VARCHAR(10) NOT NULL, -- DEBIT or CREDIT
  amount BIGINT NOT NULL, -- Always positive integer
  balance_after BIGINT NOT NULL, -- Snapshot of balance after this entry (for audit)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### How They Work Together

1. A transaction is created in `transactions` (Status: PENDING)
2. A database transaction starts
3. Lock the `accounts` row
4. Insert two rows into `ledger_entries` (one Credit, one Debit)
5. Update the `accounts` balance
6. Update `transactions` to POSTED
7. Commit
