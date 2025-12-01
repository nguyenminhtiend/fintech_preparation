# Local Fraud Detection System Setup Guide

Complete guide to set up Node.js + ClickHouse + Tinybird for fraud detection on your local machine, including seed data and queries.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: ClickHouse Setup](#part-1-clickhouse-setup)
4. [Part 2: Node.js Application](#part-2-nodejs-application)
5. [Part 3: Tinybird Setup](#part-3-tinybird-setup)
6. [Part 4: Fraud Detection Implementation](#part-4-fraud-detection-implementation)
7. [Part 5: Testing & Verification](#part-5-testing--verification)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              LOCAL FRAUD DETECTION SYSTEM                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Node.js    │──────>│  ClickHouse  │<──────│   Tinybird   │
│  Application │       │   (Local)    │       │  (Optional)  │
└──────────────┘       └──────────────┘       └──────────────┘
       │                       │
       │                       │
       ▼                       ▼
  HTTP Server          Transaction Events
  (Port 3000)          (OLAP Database)
       │                       │
       │                       │
       └───────────┬───────────┘
                   │
                   ▼
          Fraud Detection Score
          (Real-time Analysis)
```

**What we'll build:**

- ClickHouse database running locally (Docker)
- Node.js API server with fraud detection
- Seed data with realistic transaction patterns
- Fraud scoring queries based on user velocity
- Optional: Tinybird integration for API layer

---

## Prerequisites

Install these tools before starting:

```bash
# 1. Node.js (v20+)
node --version  # Should be v20 or higher

# 2. Docker (for ClickHouse)
docker --version

# 3. npm or pnpm
npm --version
```

---

## Part 1: ClickHouse Setup

### Step 1.1: Start ClickHouse with Docker

```bash
# Create project directory
mkdir fraud-detection-local
cd fraud-detection-local

# Start ClickHouse container
docker run -d \
  --name clickhouse-local \
  -p 8123:8123 \
  -p 9000:9000 \
  --ulimit nofile=262144:262144 \
  clickhouse/clickhouse-server:latest

# Verify it's running
docker ps | grep clickhouse

# Check logs
docker logs clickhouse-local
```

### Step 1.2: Access ClickHouse CLI

```bash
# Enter the container
docker exec -it clickhouse-local clickhouse-client

# You should see:
# ClickHouse client version 23.x.x.x
# Connecting to localhost:9000 as user default.
# Connected to ClickHouse server version 23.x.x.x
```

### Step 1.3: Create Database and Tables

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS fraud_detection;

USE fraud_detection;

-- Table 1: transaction_events (Append-only log)
CREATE TABLE IF NOT EXISTS transaction_events (
    event_id String,
    user_id String,
    transaction_id String,
    amount Decimal64(2),
    currency String DEFAULT 'USD',
    recipient_id String,
    transaction_type String, -- TRANSFER, DEPOSIT, WITHDRAWAL
    device_id String,
    ip_address String,
    user_agent String,
    geo_country String,
    geo_city String,
    geo_lat Float64,
    geo_lon Float64,
    timestamp DateTime64(3) DEFAULT now64(),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, timestamp)
SETTINGS index_granularity = 8192;

-- Table 2: user_velocity_features (Materialized view for pre-aggregation)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_velocity_features
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (user_id, window_start)
AS
SELECT
    user_id,
    toStartOfHour(timestamp) AS window_start,
    countState() AS txn_count,
    sumState(amount) AS total_amount,
    avgState(amount) AS avg_amount,
    uniqState(recipient_id) AS unique_recipients,
    uniqState(device_id) AS unique_devices,
    uniqState(ip_address) AS unique_ips
FROM transaction_events
GROUP BY user_id, window_start;

-- Table 3: fraud_scores_history (Store fraud check results)
CREATE TABLE IF NOT EXISTS fraud_scores_history (
    transaction_id String,
    user_id String,
    fraud_score Float64,
    decision String, -- APPROVED, DENIED, REQUIRE_2FA
    features Map(String, Float64),
    model_version String DEFAULT 'v1.0',
    checked_at DateTime64(3) DEFAULT now64()
) ENGINE = MergeTree()
ORDER BY (user_id, checked_at)
SETTINGS index_granularity = 8192;

-- Verify tables
SHOW TABLES;
```

**Expected Output:**

```
┌─name──────────────────────┐
│ fraud_scores_history      │
│ transaction_events        │
│ user_velocity_featuresz    │
└───────────────────────────┘
```

### Step 1.4: Seed Realistic Transaction Data

```sql
-- Seed 1: Normal user behavior (user_001)
-- Low frequency, consistent amounts, same location
INSERT INTO transaction_events (
    event_id, user_id, transaction_id, amount, recipient_id,
    transaction_type, device_id, ip_address,
    geo_country, geo_city, geo_lat, geo_lon, timestamp
) VALUES
    ('evt_001', 'user_001', 'txn_001', 50.00, 'user_101', 'TRANSFER', 'device_abc', '192.168.1.1', 'US', 'New York', 40.7128, -74.0060, now() - INTERVAL 2 HOUR),
    ('evt_002', 'user_001', 'txn_002', 75.50, 'user_102', 'TRANSFER', 'device_abc', '192.168.1.1', 'US', 'New York', 40.7128, -74.0060, now() - INTERVAL 1 HOUR),
    ('evt_003', 'user_001', 'txn_003', 100.00, 'user_101', 'TRANSFER', 'device_abc', '192.168.1.1', 'US', 'New York', 40.7128, -74.0060, now() - INTERVAL 30 MINUTE);

-- Seed 2: Suspicious user behavior (user_002)
-- High frequency, varying amounts, multiple locations
INSERT INTO transaction_events (
    event_id, user_id, transaction_id, amount, recipient_id,
    transaction_type, device_id, ip_address,
    geo_country, geo_city, geo_lat, geo_lon, timestamp
) VALUES
    ('evt_004', 'user_002', 'txn_004', 1000.00, 'user_201', 'TRANSFER', 'device_xyz', '10.0.0.1', 'US', 'New York', 40.7128, -74.0060, now() - INTERVAL 10 MINUTE),
    ('evt_005', 'user_002', 'txn_005', 2000.00, 'user_202', 'TRANSFER', 'device_xyz', '10.0.0.1', 'US', 'New York', 40.7128, -74.0060, now() - INTERVAL 9 MINUTE),
    ('evt_006', 'user_002', 'txn_006', 1500.00, 'user_203', 'TRANSFER', 'device_xyz', '10.0.0.1', 'US', 'New York', 40.7128, -74.0060, now() - INTERVAL 8 MINUTE),
    ('evt_007', 'user_002', 'txn_007', 3000.00, 'user_204', 'TRANSFER', 'device_999', '203.0.113.1', 'RU', 'Moscow', 55.7558, 37.6173, now() - INTERVAL 7 MINUTE),
    ('evt_008', 'user_002', 'txn_008', 2500.00, 'user_205', 'TRANSFER', 'device_999', '203.0.113.2', 'CN', 'Beijing', 39.9042, 116.4074, now() - INTERVAL 6 MINUTE),
    ('evt_009', 'user_002', 'txn_009', 5000.00, 'user_206', 'TRANSFER', 'device_888', '198.51.100.1', 'NG', 'Lagos', 6.5244, 3.3792, now() - INTERVAL 5 MINUTE);

-- Seed 3: Mixed behavior (user_003)
INSERT INTO transaction_events (
    event_id, user_id, transaction_id, amount, recipient_id,
    transaction_type, device_id, ip_address,
    geo_country, geo_city, geo_lat, geo_lon, timestamp
) VALUES
    ('evt_010', 'user_003', 'txn_010', 200.00, 'user_301', 'TRANSFER', 'device_qwe', '172.16.0.1', 'US', 'San Francisco', 37.7749, -122.4194, now() - INTERVAL 5 HOUR),
    ('evt_011', 'user_003', 'txn_011', 150.00, 'user_302', 'TRANSFER', 'device_qwe', '172.16.0.1', 'US', 'San Francisco', 37.7749, -122.4194, now() - INTERVAL 3 HOUR),
    ('evt_012', 'user_003', 'txn_012', 800.00, 'user_303', 'TRANSFER', 'device_qwe', '172.16.0.1', 'US', 'San Francisco', 37.7749, -122.4194, now() - INTERVAL 15 MINUTE),
    ('evt_013', 'user_003', 'txn_013', 900.00, 'user_304', 'TRANSFER', 'device_qwe', '172.16.0.1', 'US', 'San Francisco', 37.7749, -122.4194, now() - INTERVAL 10 MINUTE);

-- Verify data
SELECT
    user_id,
    count() AS txn_count,
    sum(amount) AS total_amount,
    avg(amount) AS avg_amount,
    min(timestamp) AS first_txn,
    max(timestamp) AS last_txn
FROM transaction_events
GROUP BY user_id
ORDER BY user_id;
```

**Expected Output:**

```
┌─user_id──┬─txn_count─┬─total_amount─┬─avg_amount─┬────────────first_txn─┬─────────────last_txn─┐
│ user_001 │         3 │       225.50 │      75.17 │ 2025-01-15 10:00:00  │ 2025-01-15 11:30:00  │
│ user_002 │         6 │     15000.00 │    2500.00 │ 2025-01-15 11:50:00  │ 2025-01-15 11:55:00  │
│ user_003 │         4 │      2050.00 │     512.50 │ 2025-01-15 07:00:00  │ 2025-01-15 11:50:00  │
└──────────┴───────────┴──────────────┴────────────┴──────────────────────┴──────────────────────┘
```

---

## Part 2: Node.js Application

### Step 2.1: Initialize Project

```bash
# Create Node.js project
mkdir nodejs-fraud-api
cd nodejs-fraud-api

# Initialize package.json
npm init -y

# Install dependencies
npm install fastify @fastify/cors @clickhouse/client zod dotenv
npm install -D typescript @types/node tsx

# Initialize TypeScript
npx tsc --init
```

### Step 2.2: Configure TypeScript

**File: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 2.3: Environment Configuration

**File: `.env`**

```bash
# ClickHouse Configuration
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_DATABASE=fraud_detection
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=development
```

### Step 2.4: ClickHouse Client Setup

**File: `src/db/clickhouse.ts`**

```typescript
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';

dotenv.config();

export const clickhouse = createClient({
  host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DATABASE || 'fraud_detection',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

// Test connection
export async function testConnection() {
  try {
    const result = await clickhouse.query({
      query: 'SELECT version() AS version',
    });
    const data = await result.json();
    console.log('✅ ClickHouse connected:', data.data[0]);
    return true;
  } catch (error) {
    console.error('❌ ClickHouse connection failed:', error);
    return false;
  }
}
```

### Step 2.5: Fraud Detection Service

**File: `src/services/fraud-detection.ts`**

```typescript
import { clickhouse } from '../db/clickhouse';

export interface FraudCheckParams {
  userId: string;
  amount: number;
  recipientId: string;
  deviceId: string;
  ipAddress: string;
  geoCountry: string;
}

export interface FraudCheckResult {
  score: number; // 0.0 - 1.0 (0 = safe, 1 = fraud)
  decision: 'APPROVED' | 'DENIED' | 'REQUIRE_2FA';
  features: {
    velocity_1h_count: number;
    velocity_1h_amount: number;
    velocity_24h_count: number;
    velocity_24h_amount: number;
    avg_amount: number;
    amount_deviation: number;
    unique_recipients_1h: number;
    unique_devices_1h: number;
    unique_ips_1h: number;
    geo_country_change: boolean;
  };
  reasons: string[];
}

export async function checkFraudScore(params: FraudCheckParams): Promise<FraudCheckResult> {
  const { userId, amount, recipientId, deviceId, ipAddress, geoCountry } = params;

  // Query 1: Get user's transaction velocity (last 1 hour)
  const velocity1hQuery = `
    SELECT
      count() AS txn_count,
      sum(amount) AS total_amount,
      avg(amount) AS avg_amount,
      uniq(recipient_id) AS unique_recipients,
      uniq(device_id) AS unique_devices,
      uniq(ip_address) AS unique_ips
    FROM transaction_events
    WHERE user_id = {userId:String}
      AND timestamp >= now() - INTERVAL 1 HOUR
  `;

  const velocity1h = await clickhouse.query({
    query: velocity1hQuery,
    query_params: { userId },
  });
  const velocity1hData = await velocity1h.json();
  const v1h = velocity1hData.data[0] || {
    txn_count: 0,
    total_amount: 0,
    avg_amount: 0,
    unique_recipients: 0,
    unique_devices: 0,
    unique_ips: 0,
  };

  // Query 2: Get user's transaction velocity (last 24 hours)
  const velocity24hQuery = `
    SELECT
      count() AS txn_count,
      sum(amount) AS total_amount,
      avg(amount) AS avg_amount
    FROM transaction_events
    WHERE user_id = {userId:String}
      AND timestamp >= now() - INTERVAL 24 HOUR
  `;

  const velocity24h = await clickhouse.query({
    query: velocity24hQuery,
    query_params: { userId },
  });
  const velocity24hData = await velocity24h.json();
  const v24h = velocity24hData.data[0] || {
    txn_count: 0,
    total_amount: 0,
    avg_amount: 0,
  };

  // Query 3: Check for geo location change
  const geoChangeQuery = `
    SELECT
      geo_country,
      max(timestamp) AS last_seen
    FROM transaction_events
    WHERE user_id = {userId:String}
      AND timestamp >= now() - INTERVAL 1 HOUR
    GROUP BY geo_country
    ORDER BY last_seen DESC
    LIMIT 1
  `;

  const geoChange = await clickhouse.query({
    query: geoChangeQuery,
    query_params: { userId },
  });
  const geoChangeData = await geoChange.json();
  const lastGeoCountry = geoChangeData.data[0]?.geo_country || geoCountry;
  const geoCountryChange = lastGeoCountry !== geoCountry;

  // Calculate features
  const avgAmount = v24h.avg_amount || 100;
  const amountDeviation = Math.abs(amount - avgAmount) / avgAmount;

  const features = {
    velocity_1h_count: Number(v1h.txn_count),
    velocity_1h_amount: Number(v1h.total_amount),
    velocity_24h_count: Number(v24h.txn_count),
    velocity_24h_amount: Number(v24h.total_amount),
    avg_amount: Number(avgAmount),
    amount_deviation: Number(amountDeviation),
    unique_recipients_1h: Number(v1h.unique_recipients),
    unique_devices_1h: Number(v1h.unique_devices),
    unique_ips_1h: Number(v1h.unique_ips),
    geo_country_change: geoCountryChange,
  };

  // Fraud scoring logic (simple rule-based model)
  let score = 0.0;
  const reasons: string[] = [];

  // Rule 1: High transaction velocity (> 5 in 1 hour)
  if (features.velocity_1h_count > 5) {
    score += 0.3;
    reasons.push('High transaction velocity (>5 in 1h)');
  }

  // Rule 2: Large amount deviation (> 3x average)
  if (features.amount_deviation > 3) {
    score += 0.25;
    reasons.push(`Amount ${amount} is ${features.amount_deviation.toFixed(1)}x average`);
  }

  // Rule 3: Multiple unique recipients in short time (> 3)
  if (features.unique_recipients_1h > 3) {
    score += 0.2;
    reasons.push('Multiple unique recipients in 1h');
  }

  // Rule 4: Multiple devices (> 2)
  if (features.unique_devices_1h > 2) {
    score += 0.15;
    reasons.push('Multiple devices detected');
  }

  // Rule 5: Geographic location change
  if (features.geo_country_change) {
    score += 0.2;
    reasons.push(`Country change detected (${lastGeoCountry} → ${geoCountry})`);
  }

  // Rule 6: Very high amount (> $5000)
  if (amount > 5000) {
    score += 0.1;
    reasons.push('High transaction amount');
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  // Make decision based on score
  let decision: 'APPROVED' | 'DENIED' | 'REQUIRE_2FA';
  if (score >= 0.85) {
    decision = 'DENIED';
  } else if (score >= 0.6) {
    decision = 'REQUIRE_2FA';
  } else {
    decision = 'APPROVED';
  }

  return {
    score: Number(score.toFixed(3)),
    decision,
    features,
    reasons,
  };
}

// Helper: Log transaction event to ClickHouse
export async function logTransactionEvent(
  params: FraudCheckParams & {
    eventId: string;
    transactionId: string;
  },
) {
  const query = `
    INSERT INTO transaction_events (
      event_id, user_id, transaction_id, amount, recipient_id,
      transaction_type, device_id, ip_address,
      geo_country, geo_city, geo_lat, geo_lon, timestamp
    ) VALUES (
      {eventId:String},
      {userId:String},
      {transactionId:String},
      {amount:Decimal64(2)},
      {recipientId:String},
      'TRANSFER',
      {deviceId:String},
      {ipAddress:String},
      {geoCountry:String},
      'Unknown',
      0.0,
      0.0,
      now64()
    )
  `;

  await clickhouse.insert({
    table: 'transaction_events',
    values: [
      {
        event_id: params.eventId,
        user_id: params.userId,
        transaction_id: params.transactionId,
        amount: params.amount,
        recipient_id: params.recipientId,
        device_id: params.deviceId,
        ip_address: params.ipAddress,
        geo_country: params.geoCountry,
        geo_city: 'Unknown',
        geo_lat: 0,
        geo_lon: 0,
      },
    ],
    format: 'JSONEachRow',
  });
}

// Helper: Store fraud score result
export async function storeFraudScore(
  transactionId: string,
  userId: string,
  result: FraudCheckResult,
) {
  await clickhouse.insert({
    table: 'fraud_scores_history',
    values: [
      {
        transaction_id: transactionId,
        user_id: userId,
        fraud_score: result.score,
        decision: result.decision,
        features: result.features,
      },
    ],
    format: 'JSONEachRow',
  });
}
```

### Step 2.6: API Routes

**File: `src/routes/fraud.ts`**

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { checkFraudScore, logTransactionEvent, storeFraudScore } from '../services/fraud-detection';
import { randomUUID } from 'crypto';

const CheckFraudSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  recipientId: z.string().min(1),
  deviceId: z.string().min(1),
  ipAddress: z.string().ip(),
  geoCountry: z.string().length(2), // ISO 3166-1 alpha-2
});

export async function fraudRoutes(server: FastifyInstance) {
  // POST /api/fraud/check - Check fraud score
  server.post('/api/fraud/check', async (request, reply) => {
    try {
      const body = CheckFraudSchema.parse(request.body);

      const result = await checkFraudScore(body);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      console.error('Fraud check error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // POST /api/fraud/simulate - Simulate transaction with fraud check
  server.post('/api/fraud/simulate', async (request, reply) => {
    try {
      const body = CheckFraudSchema.parse(request.body);

      const transactionId = `txn_${randomUUID()}`;
      const eventId = `evt_${randomUUID()}`;

      // Step 1: Check fraud score
      const fraudResult = await checkFraudScore(body);

      // Step 2: Log transaction event (only if approved)
      if (fraudResult.decision !== 'DENIED') {
        await logTransactionEvent({
          ...body,
          eventId,
          transactionId,
        });
      }

      // Step 3: Store fraud score result
      await storeFraudScore(transactionId, body.userId, fraudResult);

      return {
        success: true,
        transaction_id: transactionId,
        fraud_result: fraudResult,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      console.error('Fraud simulation error:', error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  // GET /api/fraud/history/:userId - Get fraud check history
  server.get<{ Params: { userId: string } }>(
    '/api/fraud/history/:userId',
    async (request, reply) => {
      const { userId } = request.params;

      const { clickhouse } = await import('../db/clickhouse');

      const query = `
        SELECT
          transaction_id,
          fraud_score,
          decision,
          features,
          checked_at
        FROM fraud_scores_history
        WHERE user_id = {userId:String}
        ORDER BY checked_at DESC
        LIMIT 20
      `;

      const result = await clickhouse.query({
        query,
        query_params: { userId },
      });

      const data = await result.json();

      return {
        success: true,
        data: data.data,
      };
    },
  );
}
```

### Step 2.7: Main Server

**File: `src/server.ts`**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { testConnection } from './db/clickhouse';
import { fraudRoutes } from './routes/fraud';

dotenv.config();

const server = Fastify({
  logger: true,
});

// Register plugins
server.register(cors, {
  origin: true,
});

// Register routes
server.register(fraudRoutes);

// Health check
server.get('/health', async () => {
  return {
    status: 'ok',
    service: 'fraud-detection-api',
    timestamp: new Date().toISOString(),
  };
});

// Start server
const start = async () => {
  try {
    // Test ClickHouse connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to ClickHouse');
    }

    const port = Number(process.env.PORT) || 3000;
    await server.listen({ port, host: '0.0.0.0' });

    console.log(`🚀 Server listening on http://localhost:${port}`);
    console.log(`📊 ClickHouse connected`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

### Step 2.8: Package Scripts

**File: `package.json`** (add scripts):

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

---

## Part 3: Tinybird Setup (Optional)

Tinybird provides an API layer on top of ClickHouse. It's optional but useful for production.

### Step 3.1: Sign Up for Tinybird

1. Go to https://www.tinybird.co/
2. Sign up for free account
3. Create a new Workspace

### Step 3.2: Connect Local ClickHouse to Tinybird

Unfortunately, Tinybird Cloud cannot directly connect to your local ClickHouse. You have two options:

**Option A: Use Tinybird's Managed ClickHouse**

- Import your schema and data to Tinybird
- Use Tinybird's API endpoints

**Option B: Skip Tinybird for Local Development**

- Query ClickHouse directly from Node.js (what we're doing)
- Use Tinybird only in production

For this local setup, we'll **skip Tinybird** and query ClickHouse directly.

---

## Part 4: Fraud Detection Implementation

### Step 4.1: Start the Server

```bash
# Make sure ClickHouse is running
docker ps | grep clickhouse

# Start Node.js server
npm run dev
```

**Expected output:**

```
✅ ClickHouse connected: { version: '23.x.x.x' }
🚀 Server listening on http://localhost:3000
📊 ClickHouse connected
```

### Step 4.2: Test Fraud Detection API

**Test 1: Check Normal User (user_001)**

```bash
curl -X POST http://localhost:3000/api/fraud/check \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_001",
    "amount": 60.00,
    "recipientId": "user_101",
    "deviceId": "device_abc",
    "ipAddress": "192.168.1.1",
    "geoCountry": "US"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "score": 0.0,
    "decision": "APPROVED",
    "features": {
      "velocity_1h_count": 1,
      "velocity_1h_amount": 100.0,
      "velocity_24h_count": 3,
      "velocity_24h_amount": 225.5,
      "avg_amount": 75.17,
      "amount_deviation": 0.2,
      "unique_recipients_1h": 1,
      "unique_devices_1h": 1,
      "unique_ips_1h": 1,
      "geo_country_change": false
    },
    "reasons": []
  }
}
```

**Test 2: Check Suspicious User (user_002)**

```bash
curl -X POST http://localhost:3000/api/fraud/check \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_002",
    "amount": 4000.00,
    "recipientId": "user_999",
    "deviceId": "device_new",
    "ipAddress": "1.2.3.4",
    "geoCountry": "RU"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "score": 1.0,
    "decision": "DENIED",
    "features": {
      "velocity_1h_count": 6,
      "velocity_1h_amount": 15000.0,
      "velocity_24h_count": 6,
      "velocity_24h_amount": 15000.0,
      "avg_amount": 2500.0,
      "amount_deviation": 0.6,
      "unique_recipients_1h": 6,
      "unique_devices_1h": 3,
      "unique_ips_1h": 4,
      "geo_country_change": true
    },
    "reasons": [
      "High transaction velocity (>5 in 1h)",
      "Multiple unique recipients in 1h",
      "Multiple devices detected",
      "Country change detected (CN → RU)"
    ]
  }
}
```

**Test 3: Simulate Full Transaction**

```bash
curl -X POST http://localhost:3000/api/fraud/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_003",
    "amount": 1200.00,
    "recipientId": "user_305",
    "deviceId": "device_qwe",
    "ipAddress": "172.16.0.1",
    "geoCountry": "US"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "transaction_id": "txn_a1b2c3d4-...",
  "fraud_result": {
    "score": 0.35,
    "decision": "REQUIRE_2FA",
    "features": {
      "velocity_1h_count": 2,
      "velocity_1h_amount": 1700.0,
      "velocity_24h_count": 4,
      "velocity_24h_amount": 2050.0,
      "avg_amount": 512.5,
      "amount_deviation": 1.34,
      "unique_recipients_1h": 2,
      "unique_devices_1h": 1,
      "unique_ips_1h": 1,
      "geo_country_change": false
    },
    "reasons": ["Amount 1200 is 1.3x average"]
  }
}
```

**Test 4: Get Fraud History**

```bash
curl http://localhost:3000/api/fraud/history/user_003
```

**Expected Response:**

```json
{
  "success": true,
  "data": [
    {
      "transaction_id": "txn_a1b2c3d4-...",
      "fraud_score": 0.35,
      "decision": "REQUIRE_2FA",
      "features": { ... },
      "checked_at": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

---

## Part 5: Testing & Verification

### Step 5.1: Manual ClickHouse Queries

**Query 1: Check recent transactions**

```sql
-- Enter ClickHouse CLI
docker exec -it clickhouse-local clickhouse-client

USE fraud_detection;

SELECT
    user_id,
    transaction_id,
    amount,
    timestamp,
    geo_country
FROM transaction_events
ORDER BY timestamp DESC
LIMIT 10;
```

**Query 2: User velocity analysis**

```sql
SELECT
    user_id,
    toStartOfHour(timestamp) AS hour,
    count() AS txn_count,
    sum(amount) AS total_amount,
    avg(amount) AS avg_amount,
    uniq(recipient_id) AS unique_recipients,
    uniq(device_id) AS unique_devices
FROM transaction_events
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY user_id, hour
ORDER BY user_id, hour;
```

**Query 3: Fraud scores summary**

```sql
SELECT
    decision,
    count() AS count,
    avg(fraud_score) AS avg_score,
    min(fraud_score) AS min_score,
    max(fraud_score) AS max_score
FROM fraud_scores_history
GROUP BY decision
ORDER BY decision;
```

### Step 5.2: Load Testing Script

**File: `test/load-test.sh`**

```bash
#!/bin/bash

echo "🔥 Starting fraud detection load test..."

# Test normal transactions
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/fraud/check \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user_load_$i\",
      \"amount\": $((RANDOM % 500 + 10)),
      \"recipientId\": \"user_recipient_$i\",
      \"deviceId\": \"device_test\",
      \"ipAddress\": \"192.168.1.$i\",
      \"geoCountry\": \"US\"
    }" &
done

wait

echo "✅ Load test completed!"
```

```bash
chmod +x test/load-test.sh
./test/load-test.sh
```

### Step 5.3: Verify Performance

**Check query execution time:**

```sql
-- In ClickHouse CLI
SET send_logs_level = 'trace';

SELECT
    count() AS txn_count,
    sum(amount) AS total_amount
FROM transaction_events
WHERE user_id = 'user_002'
  AND timestamp >= now() - INTERVAL 1 HOUR;

-- Look for "Query execution time" in output
-- Should be < 10ms for this dataset
```

---

## Part 6: Advanced Queries

### Query 1: Real-time Fraud Detection Score

```sql
-- Calculate fraud score for a user in real-time
WITH user_stats AS (
    SELECT
        count() AS txn_1h,
        sum(amount) AS amount_1h,
        avg(amount) AS avg_amount,
        uniq(recipient_id) AS unique_recipients,
        uniq(device_id) AS unique_devices,
        uniq(geo_country) AS unique_countries
    FROM transaction_events
    WHERE user_id = 'user_002'
      AND timestamp >= now() - INTERVAL 1 HOUR
)
SELECT
    txn_1h,
    amount_1h,
    avg_amount,
    unique_recipients,
    unique_devices,
    unique_countries,
    -- Simple fraud score calculation
    CASE
        WHEN txn_1h > 5 THEN 0.3
        ELSE 0.0
    END +
    CASE
        WHEN unique_recipients > 3 THEN 0.2
        ELSE 0.0
    END +
    CASE
        WHEN unique_devices > 2 THEN 0.15
        ELSE 0.0
    END +
    CASE
        WHEN unique_countries > 1 THEN 0.2
        ELSE 0.0
    END AS fraud_score
FROM user_stats;
```

### Query 2: Detect Anomalies

```sql
-- Find users with abnormal behavior
SELECT
    user_id,
    count() AS txn_count,
    sum(amount) AS total_amount,
    avg(amount) AS avg_amount,
    uniq(recipient_id) AS unique_recipients,
    uniq(device_id) AS unique_devices,
    uniq(geo_country) AS unique_countries
FROM transaction_events
WHERE timestamp >= now() - INTERVAL 1 HOUR
GROUP BY user_id
HAVING txn_count > 3 OR unique_countries > 1
ORDER BY txn_count DESC;
```

### Query 3: Geographic Risk Analysis

```sql
-- Analyze transactions by country
SELECT
    geo_country,
    count() AS txn_count,
    sum(amount) AS total_amount,
    avg(amount) AS avg_amount,
    uniq(user_id) AS unique_users
FROM transaction_events
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY geo_country
ORDER BY total_amount DESC;
```

---

## Troubleshooting

### Issue 1: ClickHouse Connection Failed

```bash
# Check if container is running
docker ps | grep clickhouse

# Check logs
docker logs clickhouse-local

# Restart container
docker restart clickhouse-local
```

### Issue 2: Empty Query Results

```sql
-- Check if data exists
SELECT count() FROM transaction_events;

-- Check timestamp range
SELECT min(timestamp), max(timestamp) FROM transaction_events;
```

### Issue 3: Slow Queries

```sql
-- Optimize table
OPTIMIZE TABLE transaction_events FINAL;

-- Check table size
SELECT
    formatReadableSize(sum(bytes)) AS size
FROM system.parts
WHERE table = 'transaction_events';
```

---

## Next Steps

1. **Add ML Model**: Replace rule-based scoring with scikit-learn or TensorFlow model
2. **Add Redis Caching**: Cache fraud scores for 1-2 minutes
3. **Add Kafka Integration**: Stream transactions to ClickHouse via Kafka
4. **Deploy to Production**: Use Tinybird Cloud for managed ClickHouse + API
5. **Add Monitoring**: Integrate Grafana + Prometheus for metrics

---

## Summary

You now have a complete local fraud detection system with:

✅ ClickHouse running in Docker
✅ Node.js API with fraud detection
✅ Realistic seed data (normal, suspicious, mixed users)
✅ Real-time fraud scoring based on velocity
✅ REST API endpoints for checking fraud
✅ Transaction event logging
✅ Fraud score history tracking

**Test the system:**

```bash
# Start ClickHouse
docker start clickhouse-local

# Start Node.js API
npm run dev

# Test fraud detection
curl -X POST http://localhost:3000/api/fraud/check \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_002", "amount": 5000, ...}'
```

Your fraud detection system is ready! 🎉
