# Module 5: Real-Time Analytics with ClickHouse 📊

## Summary

This module implements a production-grade OLAP (Online Analytical Processing) analytics layer using ClickHouse for real-time transaction analytics, fraud detection queries, and reconciliation dashboards. It demonstrates the industry-standard hybrid OLTP + OLAP architecture used by modern fintech platforms.

### Why This Module is Critical

- **Addresses requirement**: Exposure to ClickHouse/Tinybird
- **Industry standard**: Stripe, Wise, Revolut all use ClickHouse for analytics
- **Performance**: Sub-second queries on billions of transactions
- **Real-world use case**: Real-time fraud detection, merchant dashboards, compliance reporting

---

## Architecture Overview

### Hybrid OLTP + OLAP Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Web App    │  │  Mobile App  │  │   Admin UI   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
└─────────┬───────────────────────────────────┬───────────────┘
          │                                   │
    WRITE PATH                            READ PATH
          │                                   │
          ▼                                   ▼
┌─────────────────┐                 ┌──────────────────┐
│   PostgreSQL    │                 │   ClickHouse     │
│     (OLTP)      │                 │     (OLAP)       │
│                 │                 │                  │
│ - Transactions  │◄───────CDC──────┤ - Analytics      │
│ - User Data     │  Debezium+Kafka │ - Reports        │
│ - ACID          │                 │ - Real-time APIs │
│ - Normalized    │                 │ - Dashboards     │
└─────────┬───────┘                 └──────────────────┘
          │                                   ▲
          │                                   │
          ▼                                   │
┌─────────────────┐                          │
│   Event Bus     │──────────────────────────┘
│     (Kafka)     │
│                 │
│ - CDC Events    │
│ - Domain Events │
│ - Audit Logs    │
└─────────────────┘
```

### Data Flow

1. **Write Path**: PostgreSQL handles transactional writes (ACID guarantees)
2. **CDC Pipeline**: Debezium captures changes from PostgreSQL WAL → Kafka
3. **Read Path**: ClickHouse consumes Kafka events for analytics
4. **Query Layer**: Applications query ClickHouse for dashboards/reports

---

## Database Schema Design

### ClickHouse Tables

#### 1. Transactions (Analytical Table)

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS fintech_analytics;

-- Kafka consumption table (raw events)
CREATE TABLE fintech_analytics.transactions_kafka (
    transaction_id String,
    idempotency_key String,
    reference_number String,
    type String,
    status String,
    amount String,
    currency String,
    from_account_id String,
    to_account_id String,
    description String,
    metadata String,
    created_at String,
    completed_at String,
    __deleted UInt8
) ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'fintech_server.public.transactions',
    kafka_group_name = 'clickhouse_transactions',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 2;

-- Analytical table (queryable, optimized)
CREATE TABLE fintech_analytics.transactions (
    transaction_id UUID,
    idempotency_key String,
    reference_number String,
    type LowCardinality(String),
    status LowCardinality(String),

    -- Financial data
    amount Decimal(18, 2),
    currency FixedString(3),

    -- Accounts
    from_account_id Nullable(UUID),
    to_account_id Nullable(UUID),

    -- Metadata
    description Nullable(String) CODEC(ZSTD(3)),
    metadata String CODEC(ZSTD(3)),

    -- Timestamps
    created_at DateTime64(3, 'UTC'),
    completed_at Nullable(DateTime64(3, 'UTC')),

    -- CDC metadata
    __deleted UInt8,
    __version UInt64,

    -- Indexes for fast filtering
    INDEX idx_reference reference_number TYPE bloom_filter GRANULARITY 4,
    INDEX idx_amount amount TYPE minmax GRANULARITY 8

) ENGINE = ReplacingMergeTree(__version)
PARTITION BY toYYYYMM(created_at)
ORDER BY (from_account_id, created_at, transaction_id)
SETTINGS index_granularity = 8192;

-- Materialized view for transformation
CREATE MATERIALIZED VIEW fintech_analytics.transactions_mv TO fintech_analytics.transactions AS
SELECT
    toUUIDOrZero(transaction_id) AS transaction_id,
    idempotency_key,
    reference_number,
    type,
    status,
    toDecimal64OrZero(amount, 2) AS amount,
    currency,
    toUUIDOrNull(from_account_id) AS from_account_id,
    toUUIDOrNull(to_account_id) AS to_account_id,
    description,
    metadata,
    parseDateTime64BestEffort(created_at) AS created_at,
    if(completed_at != '', parseDateTime64BestEffort(completed_at), NULL) AS completed_at,
    __deleted,
    toUnixTimestamp64Milli(now64()) AS __version
FROM fintech_analytics.transactions_kafka;
```

#### 2. Transaction Reservations

```sql
CREATE TABLE fintech_analytics.transaction_reservations_kafka (
    id String,
    transaction_id String,
    account_id String,
    amount String,
    expires_at String,
    status String,
    created_at String,
    __deleted UInt8
) ENGINE = Kafka()
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'fintech_server.public.transaction_reservations',
    kafka_group_name = 'clickhouse_reservations',
    kafka_format = 'JSONEachRow';

CREATE TABLE fintech_analytics.transaction_reservations (
    id UUID,
    transaction_id UUID,
    account_id UUID,
    amount Decimal(18, 2),
    expires_at DateTime64(3, 'UTC'),
    status LowCardinality(String),
    created_at DateTime64(3, 'UTC'),
    __deleted UInt8,
    __version UInt64
) ENGINE = ReplacingMergeTree(__version)
PARTITION BY toYYYYMM(created_at)
ORDER BY (account_id, created_at, id);

CREATE MATERIALIZED VIEW fintech_analytics.transaction_reservations_mv
TO fintech_analytics.transaction_reservations AS
SELECT
    toUUIDOrZero(id) AS id,
    toUUIDOrZero(transaction_id) AS transaction_id,
    toUUIDOrZero(account_id) AS account_id,
    toDecimal64OrZero(amount, 2) AS amount,
    parseDateTime64BestEffort(expires_at) AS expires_at,
    status,
    parseDateTime64BestEffort(created_at) AS created_at,
    __deleted,
    toUnixTimestamp64Milli(now64()) AS __version
FROM fintech_analytics.transaction_reservations_kafka;
```

#### 3. Accounts

```sql
CREATE TABLE fintech_analytics.accounts (
    id UUID,
    customer_id Nullable(UUID),
    account_number String,
    currency FixedString(3),
    balance Decimal(18, 2),
    available_balance Decimal(18, 2),
    status LowCardinality(String),
    created_at DateTime64(3, 'UTC'),
    updated_at DateTime64(3, 'UTC'),
    __deleted UInt8,
    __version UInt64
) ENGINE = ReplacingMergeTree(__version)
PARTITION BY toYYYYMM(created_at)
ORDER BY (customer_id, created_at, id);
```

#### 4. Ledger Entries

```sql
CREATE TABLE fintech_analytics.ledger_entries (
    id UUID,
    transaction_id Nullable(UUID),
    account_id Nullable(UUID),
    entry_type LowCardinality(String), -- DEBIT or CREDIT
    amount Decimal(18, 2),
    balance_after Nullable(Decimal(18, 2)),
    created_at DateTime64(3, 'UTC'),
    __deleted UInt8,
    __version UInt64
) ENGINE = ReplacingMergeTree(__version)
PARTITION BY toYYYYMM(created_at)
ORDER BY (account_id, created_at, id);
```

---

## Materialized Views for Pre-Aggregations

### 1. Hourly Transaction Metrics

```sql
CREATE MATERIALIZED VIEW fintech_analytics.hourly_transaction_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, currency, status, type)
AS
SELECT
    toStartOfHour(created_at) AS hour,
    currency,
    status,
    type,
    count() AS txn_count,
    sum(amount) AS total_volume,
    avg(amount) AS avg_amount,
    quantile(0.5)(amount) AS median_amount,
    quantile(0.95)(amount) AS p95_amount,
    quantile(0.99)(amount) AS p99_amount,
    uniqExact(from_account_id) AS unique_senders,
    uniqExact(to_account_id) AS unique_receivers,
    countIf(status = 'COMPLETED') AS completed_count,
    countIf(status = 'FAILED') AS failed_count,
    countIf(status = 'PENDING') AS pending_count
FROM fintech_analytics.transactions FINAL
WHERE __deleted = 0
GROUP BY hour, currency, status, type;
```

### 2. Account Activity Summary

```sql
CREATE MATERIALIZED VIEW fintech_analytics.account_activity_summary
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (account_id, date)
AS
SELECT
    from_account_id AS account_id,
    toDate(created_at) AS date,
    countState() AS txn_count,
    sumState(amount) AS total_sent,
    avgState(amount) AS avg_transaction_amount,
    maxState(amount) AS max_transaction_amount,
    uniqState(to_account_id) AS unique_recipients
FROM fintech_analytics.transactions FINAL
WHERE __deleted = 0 AND from_account_id IS NOT NULL
GROUP BY account_id, date;
```

### 3. Fraud Detection Metrics

```sql
CREATE MATERIALIZED VIEW fintech_analytics.fraud_detection_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (account_id, window_start)
AS
SELECT
    from_account_id AS account_id,
    toStartOfFiveMinutes(created_at) AS window_start,
    count() AS txn_count_5min,
    sum(amount) AS total_amount_5min,
    avg(amount) AS avg_amount_5min,
    stddevPop(amount) AS stddev_amount_5min,
    max(amount) AS max_amount_5min,
    uniqExact(to_account_id) AS unique_recipients_5min,
    uniqExact(currency) AS unique_currencies_5min
FROM fintech_analytics.transactions FINAL
WHERE __deleted = 0 AND from_account_id IS NOT NULL
GROUP BY account_id, window_start;
```

### 4. Daily Reconciliation Summary

```sql
CREATE MATERIALIZED VIEW fintech_analytics.daily_reconciliation
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (date, currency)
AS
SELECT
    toDate(created_at) AS date,
    currency,
    sum(amount) AS total_volume,
    count() AS total_transactions,
    countIf(status = 'COMPLETED') AS completed_transactions,
    countIf(status = 'FAILED') AS failed_transactions,
    countIf(status = 'PENDING') AS pending_transactions,
    max(created_at) AS updated_at
FROM fintech_analytics.transactions FINAL
WHERE __deleted = 0
GROUP BY date, currency;
```

---

## Key Analytics Queries

### 1. Real-Time Transaction Dashboard

```sql
-- Last 24 hours summary
SELECT
    toStartOfHour(hour) AS hour_start,
    currency,
    sum(txn_count) AS transactions,
    sum(total_volume) AS volume,
    avg(avg_amount) AS avg_txn_amount,
    sum(completed_count) AS successful,
    sum(failed_count) AS failed,
    round((sum(failed_count) / sum(txn_count)) * 100, 2) AS failure_rate_pct
FROM fintech_analytics.hourly_transaction_metrics
WHERE hour >= now() - INTERVAL 24 HOUR
GROUP BY hour_start, currency
ORDER BY hour_start DESC, currency;
```

### 2. Account Transaction History (with running balance)

```sql
-- Get transaction history with balance calculation
SELECT
    t.transaction_id,
    t.reference_number,
    t.type,
    t.amount,
    t.currency,
    t.description,
    t.status,
    t.created_at,
    l.balance_after
FROM fintech_analytics.transactions FINAL t
LEFT JOIN fintech_analytics.ledger_entries FINAL l
    ON t.transaction_id = l.transaction_id
    AND l.account_id = {accountId: UUID}
WHERE (t.from_account_id = {accountId: UUID} OR t.to_account_id = {accountId: UUID})
    AND t.__deleted = 0
    AND t.created_at >= {startDate: DateTime}
    AND t.created_at < {endDate: DateTime}
ORDER BY t.created_at DESC
LIMIT 100;
```

### 3. Fraud Detection - Real-Time Anomaly Detection

```sql
-- Detect accounts with suspicious transaction patterns (last 5 minutes)
WITH account_stats AS (
    SELECT
        account_id,
        txn_count_5min,
        total_amount_5min,
        avg_amount_5min,
        stddev_amount_5min,
        unique_recipients_5min,
        unique_currencies_5min
    FROM fintech_analytics.fraud_detection_metrics
    WHERE window_start >= now() - INTERVAL 5 MINUTE
)
SELECT
    t.transaction_id,
    t.reference_number,
    t.from_account_id AS account_id,
    t.amount,
    t.created_at,
    s.txn_count_5min,
    s.unique_recipients_5min,
    s.unique_currencies_5min,
    abs((t.amount - s.avg_amount_5min) / nullIf(s.stddev_amount_5min, 0)) AS z_score,
    multiIf(
        s.txn_count_5min > 20, 'HIGH_FREQUENCY',
        s.unique_currencies_5min >= 3, 'MULTIPLE_CURRENCIES',
        abs((t.amount - s.avg_amount_5min) / nullIf(s.stddev_amount_5min, 0)) > 3, 'AMOUNT_ANOMALY',
        'NORMAL'
    ) AS anomaly_type
FROM fintech_analytics.transactions FINAL t
JOIN account_stats s ON t.from_account_id = s.account_id
WHERE t.created_at >= now() - INTERVAL 5 MINUTE
    AND t.__deleted = 0
    AND (
        s.txn_count_5min > 20
        OR s.unique_currencies_5min >= 3
        OR abs((t.amount - s.avg_amount_5min) / nullIf(s.stddev_amount_5min, 0)) > 3
    )
ORDER BY z_score DESC
LIMIT 100;
```

### 4. Balance Reconciliation Report

```sql
-- Daily reconciliation: Compare account balances with ledger entries
WITH account_balances AS (
    SELECT
        id AS account_id,
        balance AS reported_balance,
        available_balance
    FROM fintech_analytics.accounts FINAL
    WHERE __deleted = 0
),
ledger_balances AS (
    SELECT
        account_id,
        sum(multiIf(entry_type = 'CREDIT', amount, entry_type = 'DEBIT', -amount, 0)) AS calculated_balance
    FROM fintech_analytics.ledger_entries FINAL
    WHERE __deleted = 0
    GROUP BY account_id
)
SELECT
    a.account_id,
    a.reported_balance,
    l.calculated_balance,
    a.reported_balance - l.calculated_balance AS variance,
    abs(a.reported_balance - l.calculated_balance) > 0.01 AS has_discrepancy
FROM account_balances a
LEFT JOIN ledger_balances l ON a.account_id = l.account_id
WHERE abs(a.reported_balance - l.calculated_balance) > 0.01
ORDER BY abs(variance) DESC
LIMIT 100;
```

### 5. Transaction Volume Trends

```sql
-- 30-day transaction volume comparison
SELECT
    date,
    currency,
    total_volume,
    total_transactions,
    round(total_volume / total_transactions, 2) AS avg_txn_size,
    round((total_volume / lag(total_volume) OVER (PARTITION BY currency ORDER BY date) - 1) * 100, 2) AS volume_growth_pct
FROM fintech_analytics.daily_reconciliation
WHERE date >= today() - INTERVAL 30 DAY
ORDER BY date DESC, currency;
```

### 6. Top Accounts by Transaction Volume

```sql
-- Top 100 accounts by volume (last 30 days)
SELECT
    account_id,
    count() AS txn_count,
    sum(amount) AS total_volume,
    avg(amount) AS avg_amount,
    max(amount) AS max_amount,
    min(created_at) AS first_txn,
    max(created_at) AS last_txn
FROM fintech_analytics.transactions FINAL
WHERE from_account_id IS NOT NULL
    AND __deleted = 0
    AND created_at >= today() - INTERVAL 30 DAY
GROUP BY from_account_id AS account_id
ORDER BY total_volume DESC
LIMIT 100;
```

---

## Node.js Integration (@clickhouse/client)

### Installation

```bash
npm install @clickhouse/client
```

### Analytics Service

```typescript
// src/services/clickhouse-analytics.service.ts

import { createClient, ClickHouseClient } from '@clickhouse/client';

interface TransactionMetrics {
  hour_start: string;
  currency: string;
  transactions: number;
  volume: number;
  avg_txn_amount: number;
  successful: number;
  failed: number;
  failure_rate_pct: number;
}

interface FraudAlert {
  transaction_id: string;
  reference_number: string;
  account_id: string;
  amount: number;
  created_at: string;
  txn_count_5min: number;
  unique_recipients_5min: number;
  z_score: number;
  anomaly_type: string;
}

interface ReconciliationIssue {
  account_id: string;
  reported_balance: number;
  calculated_balance: number;
  variance: number;
  has_discrepancy: boolean;
}

export class ClickHouseAnalyticsService {
  private client: ClickHouseClient;

  constructor() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: 'fintech_analytics',

      // Connection pool
      max_open_connections: 10,

      // Compression (recommended)
      compression: {
        request: true,
        response: true,
      },

      // ClickHouse settings
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
        max_execution_time: 60,
      },
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result.success;
    } catch (error) {
      console.error('ClickHouse health check failed:', error);
      return false;
    }
  }

  async getRealtimeMetrics(hours: number = 24): Promise<TransactionMetrics[]> {
    const query = `
      SELECT
        toString(toStartOfHour(hour)) AS hour_start,
        currency,
        sum(txn_count) AS transactions,
        sum(total_volume) AS volume,
        avg(avg_amount) AS avg_txn_amount,
        sum(completed_count) AS successful,
        sum(failed_count) AS failed,
        round((sum(failed_count) / sum(txn_count)) * 100, 2) AS failure_rate_pct
      FROM hourly_transaction_metrics
      WHERE hour >= now() - INTERVAL {hours: UInt32} HOUR
      GROUP BY hour_start, currency
      ORDER BY hour_start DESC, currency
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: { hours },
    });

    return await result.json<TransactionMetrics>();
  }

  async detectFraudAnomalies(lookbackMinutes: number = 5): Promise<FraudAlert[]> {
    const query = `
      WITH account_stats AS (
        SELECT
          account_id,
          txn_count_5min,
          total_amount_5min,
          avg_amount_5min,
          stddev_amount_5min,
          unique_recipients_5min,
          unique_currencies_5min
        FROM fraud_detection_metrics
        WHERE window_start >= now() - INTERVAL {lookbackMinutes: UInt32} MINUTE
      )
      SELECT
        toString(t.transaction_id) AS transaction_id,
        t.reference_number,
        toString(t.from_account_id) AS account_id,
        t.amount,
        toString(t.created_at) AS created_at,
        s.txn_count_5min,
        s.unique_recipients_5min,
        abs((t.amount - s.avg_amount_5min) / nullIf(s.stddev_amount_5min, 0)) AS z_score,
        multiIf(
          s.txn_count_5min > 20, 'HIGH_FREQUENCY',
          s.unique_currencies_5min >= 3, 'MULTIPLE_CURRENCIES',
          abs((t.amount - s.avg_amount_5min) / nullIf(s.stddev_amount_5min, 0)) > 3, 'AMOUNT_ANOMALY',
          'NORMAL'
        ) AS anomaly_type
      FROM transactions FINAL t
      JOIN account_stats s ON t.from_account_id = s.account_id
      WHERE t.created_at >= now() - INTERVAL {lookbackMinutes: UInt32} MINUTE
        AND t.__deleted = 0
        AND (
          s.txn_count_5min > 20
          OR s.unique_currencies_5min >= 3
          OR abs((t.amount - s.avg_amount_5min) / nullIf(s.stddev_amount_5min, 0)) > 3
        )
      ORDER BY z_score DESC
      LIMIT 100
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: { lookbackMinutes },
    });

    return await result.json<FraudAlert>();
  }

  async getReconciliationIssues(): Promise<ReconciliationIssue[]> {
    const query = `
      WITH account_balances AS (
        SELECT
          toString(id) AS account_id,
          balance AS reported_balance,
          available_balance
        FROM accounts FINAL
        WHERE __deleted = 0
      ),
      ledger_balances AS (
        SELECT
          toString(account_id) AS account_id,
          sum(multiIf(
            entry_type = 'CREDIT', amount,
            entry_type = 'DEBIT', -amount,
            0
          )) AS calculated_balance
        FROM ledger_entries FINAL
        WHERE __deleted = 0
        GROUP BY account_id
      )
      SELECT
        a.account_id,
        a.reported_balance,
        l.calculated_balance,
        a.reported_balance - l.calculated_balance AS variance,
        abs(a.reported_balance - l.calculated_balance) > 0.01 AS has_discrepancy
      FROM account_balances a
      LEFT JOIN ledger_balances l ON a.account_id = l.account_id
      WHERE abs(a.reported_balance - l.calculated_balance) > 0.01
      ORDER BY abs(variance) DESC
      LIMIT 100
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
    });

    return await result.json<ReconciliationIssue>();
  }

  async getTransactionHistory(
    accountId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100,
  ) {
    const query = `
      SELECT
        toString(t.transaction_id) AS transaction_id,
        t.reference_number,
        t.type,
        t.amount,
        t.currency,
        t.description,
        t.status,
        toString(t.created_at) AS created_at,
        l.balance_after
      FROM transactions FINAL t
      LEFT JOIN ledger_entries FINAL l
        ON t.transaction_id = l.transaction_id
        AND l.account_id = {accountId: UUID}
      WHERE (t.from_account_id = {accountId: UUID}
          OR t.to_account_id = {accountId: UUID})
        AND t.__deleted = 0
        AND t.created_at >= {startDate: DateTime}
        AND t.created_at < {endDate: DateTime}
      ORDER BY t.created_at DESC
      LIMIT {limit: UInt32}
    `;

    const result = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: {
        accountId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit,
      },
    });

    return await result.json();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

### Express API Routes

```typescript
// src/routes/analytics.routes.ts

import { Router } from 'express';
import { ClickHouseAnalyticsService } from '../services/clickhouse-analytics.service';

const router = Router();
const analytics = new ClickHouseAnalyticsService();

// GET /api/analytics/realtime-metrics
router.get('/realtime-metrics', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const metrics = await analytics.getRealtimeMetrics(parseInt(hours as string));

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error fetching realtime metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/fraud-alerts
router.get('/fraud-alerts', async (req, res) => {
  try {
    const { lookback_minutes = 5 } = req.query;
    const alerts = await analytics.detectFraudAnomalies(parseInt(lookback_minutes as string));

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error('Error detecting fraud alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/reconciliation-issues
router.get('/reconciliation-issues', async (req, res) => {
  try {
    const issues = await analytics.getReconciliationIssues();

    res.json({
      success: true,
      count: issues.length,
      data: issues,
    });
  } catch (error) {
    console.error('Error fetching reconciliation issues:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/transaction-history/:accountId
router.get('/transaction-history/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { start_date, end_date, limit = 100 } = req.query;

    const history = await analytics.getTransactionHistory(
      accountId,
      new Date(start_date as string),
      new Date(end_date as string),
      parseInt(limit as string),
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/health
router.get('/health', async (req, res) => {
  const healthy = await analytics.healthCheck();

  if (healthy) {
    res.json({ status: 'healthy', service: 'clickhouse' });
  } else {
    res.status(503).json({ status: 'unhealthy', service: 'clickhouse' });
  }
});

export default router;
```

---

## CDC Setup (PostgreSQL → Kafka → ClickHouse)

### 1. PostgreSQL Configuration

```sql
-- Enable logical replication
ALTER SYSTEM SET wal_level = 'logical';
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET max_wal_senders = 10;

-- Restart PostgreSQL after changes
-- pg_ctl restart
```

### 2. Debezium Connector Configuration

```json
{
  "name": "postgres-fintech-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "postgres",
    "database.password": "postgres",
    "database.dbname": "fintech_db",
    "database.server.name": "fintech_server",
    "table.include.list": "public.transactions,public.transaction_reservations,public.accounts,public.ledger_entries",
    "plugin.name": "pgoutput",
    "publication.autocreate.mode": "filtered",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.drop.tombstones": "false",
    "key.converter": "org.apache.kafka.connect.json.JsonConverter",
    "value.converter": "org.apache.kafka.connect.json.JsonConverter",
    "topic.prefix": "fintech_server"
  }
}
```

### 3. Docker Compose Setup

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fintech_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    command:
      - 'postgres'
      - '-c'
      - 'wal_level=logical'
      - '-c'
      - 'max_replication_slots=10'
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - '9092:9092'
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'

  debezium:
    image: debezium/connect:2.4
    depends_on:
      - kafka
      - postgres
    ports:
      - '8083:8083'
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: debezium
      CONFIG_STORAGE_TOPIC: debezium_configs
      OFFSET_STORAGE_TOPIC: debezium_offsets
      STATUS_STORAGE_TOPIC: debezium_statuses

  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ports:
      - '8123:8123'
      - '9000:9000'
    environment:
      CLICKHOUSE_DB: fintech_analytics
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: clickhouse
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./clickhouse-config.xml:/etc/clickhouse-server/config.d/config.xml

volumes:
  postgres_data:
  clickhouse_data:
```

---

## Performance Benchmarks & Optimization

### Query Performance Targets

- **Real-time dashboard queries**: <500ms (p95)
- **Fraud detection queries**: <1s (p95)
- **Reconciliation queries**: <2s (p95)
- **Historical reports**: <5s (p95)

### Optimization Techniques

1. **Use FINAL sparingly**: Only when deduplication is critical
2. **Leverage materialized views**: Pre-aggregate common queries
3. **Partition pruning**: Filter by partition key (date)
4. **Index optimization**: Bloom filters for high-cardinality columns
5. **Compression**: Use ZSTD(3) for text fields

### Monitoring Queries

```sql
-- Check table sizes
SELECT
    table,
    formatReadableSize(sum(bytes_on_disk)) AS size,
    sum(rows) AS rows,
    round(sum(bytes_on_disk) / sum(rows), 2) AS bytes_per_row
FROM system.parts
WHERE active AND database = 'fintech_analytics'
GROUP BY table
ORDER BY sum(bytes_on_disk) DESC;

-- Query performance
SELECT
    query,
    type,
    event_time,
    query_duration_ms,
    read_rows,
    formatReadableSize(read_bytes) AS read_bytes,
    formatReadableSize(memory_usage) AS memory_usage
FROM system.query_log
WHERE type = 'QueryFinish'
    AND event_time >= now() - INTERVAL 1 HOUR
    AND database = 'fintech_analytics'
ORDER BY query_duration_ms DESC
LIMIT 20;
```

---

## Learning Outcomes

✅ **OLTP vs OLAP architecture**: Understand when to use each
✅ **Change Data Capture (CDC)**: Real-time data synchronization
✅ **Materialized views**: Pre-aggregated queries for performance
✅ **Columnar storage**: Why ClickHouse is fast for analytics
✅ **Event streaming**: Kafka for reliable data pipelines
✅ **Production deployment**: Docker Compose for local development

---

## Next Steps

1. Set up local environment with Docker Compose
2. Configure PostgreSQL logical replication
3. Set up Debezium connector
4. Create ClickHouse schema and materialized views
5. Test CDC pipeline (insert data in Postgres, query in ClickHouse)
6. Implement Node.js analytics service
7. Build API endpoints for dashboards
8. Add monitoring and alerting

---

## References

- [ClickHouse Official Documentation](https://clickhouse.com/docs)
- [Debezium PostgreSQL Connector](https://debezium.io/documentation/reference/connectors/postgresql.html)
- [@clickhouse/client NPM Package](https://www.npmjs.com/package/@clickhouse/client)
- [Change Data Capture with ClickHouse](https://clickhouse.com/blog/clickhouse-postgresql-change-data-capture-cdc-part-1)
