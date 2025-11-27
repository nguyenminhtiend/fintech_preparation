-- Seed Script for Accounts and Transactions
-- This script creates test data with valid UUIDs

-- Clean up existing data (optional - uncomment if needed)
-- DELETE FROM transaction_reservations;
-- DELETE FROM ledger_entries;
-- DELETE FROM transactions;
-- DELETE FROM payment_methods;
-- DELETE FROM accounts;
-- DELETE FROM customers;
-- DELETE FROM users;

-- Insert Users
INSERT INTO users (id, email, first_name, last_name, date_of_birth, phone, created_at, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001'::uuid, 'john.doe@example.com', 'John', 'Doe', '1990-05-15', '+1234567890', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002'::uuid, 'jane.smith@example.com', 'Jane', 'Smith', '1985-08-22', '+1234567891', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003'::uuid, 'bob.wilson@example.com', 'Bob', 'Wilson', '1992-03-10', '+1234567892', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440004'::uuid, 'alice.brown@example.com', 'Alice', 'Brown', '1988-11-30', '+1234567893', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert Customers
INSERT INTO customers (id, user_id, customer_code, status, kyc_status, risk_score, address_line1, city, country, created_at)
VALUES
  ('650e8400-e29b-41d4-a716-446655440001'::uuid, '550e8400-e29b-41d4-a716-446655440001'::uuid, 'CUST001', 'ACTIVE', 'VERIFIED', 25, '123 Main St', 'New York', 'US', NOW()),
  ('650e8400-e29b-41d4-a716-446655440002'::uuid, '550e8400-e29b-41d4-a716-446655440002'::uuid, 'CUST002', 'ACTIVE', 'VERIFIED', 15, '456 Oak Ave', 'Los Angeles', 'US', NOW()),
  ('650e8400-e29b-41d4-a716-446655440003'::uuid, '550e8400-e29b-41d4-a716-446655440003'::uuid, 'CUST003', 'ACTIVE', 'VERIFIED', 30, '789 Pine Rd', 'Chicago', 'US', NOW()),
  ('650e8400-e29b-41d4-a716-446655440004'::uuid, '550e8400-e29b-41d4-a716-446655440004'::uuid, 'CUST004', 'ACTIVE', 'PENDING', 50, '321 Elm St', 'Houston', 'US', NOW())
ON CONFLICT (customer_code) DO NOTHING;

-- Insert Accounts (amounts in cents: 100000 = $1000.00)
INSERT INTO accounts (id, customer_id, account_number, currency, balance, available_balance, status, created_at, updated_at)
VALUES
  ('750e8400-e29b-41d4-a716-446655440001'::uuid, '650e8400-e29b-41d4-a716-446655440001'::uuid, 'ACC10001', 'USD', 500000, 500000, 'ACTIVE', NOW(), NOW()),
  ('750e8400-e29b-41d4-a716-446655440002'::uuid, '650e8400-e29b-41d4-a716-446655440002'::uuid, 'ACC10002', 'USD', 1000000, 1000000, 'ACTIVE', NOW(), NOW()),
  ('750e8400-e29b-41d4-a716-446655440003'::uuid, '650e8400-e29b-41d4-a716-446655440003'::uuid, 'ACC10003', 'USD', 250000, 250000, 'ACTIVE', NOW(), NOW()),
  ('750e8400-e29b-41d4-a716-446655440004'::uuid, '650e8400-e29b-41d4-a716-446655440004'::uuid, 'ACC10004', 'USD', 750000, 750000, 'ACTIVE', NOW(), NOW()),
  ('750e8400-e29b-41d4-a716-446655440005'::uuid, '650e8400-e29b-41d4-a716-446655440001'::uuid, 'ACC10005', 'USD', 150000, 150000, 'ACTIVE', NOW(), NOW())
ON CONFLICT (account_number) DO NOTHING;

-- Insert Transactions (COMPLETED)
INSERT INTO transactions (id, idempotency_key, reference_number, type, status, amount, currency, from_account_id, to_account_id, description, metadata, created_at, completed_at)
VALUES
  -- Transfer from ACC10001 to ACC10002
  ('850e8400-e29b-41d4-a716-446655440001'::uuid, 'idem-key-001', 'TXN20001', 'TRANSFER', 'COMPLETED', 10000, 'USD',
   '750e8400-e29b-41d4-a716-446655440001'::uuid, '750e8400-e29b-41d4-a716-446655440002'::uuid,
   'Payment for services', '{"category": "services", "note": "Monthly fee"}', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

  -- Transfer from ACC10002 to ACC10003
  ('850e8400-e29b-41d4-a716-446655440002'::uuid, 'idem-key-002', 'TXN20002', 'TRANSFER', 'COMPLETED', 25000, 'USD',
   '750e8400-e29b-41d4-a716-446655440002'::uuid, '750e8400-e29b-41d4-a716-446655440003'::uuid,
   'Rent payment', '{"category": "rent", "period": "2025-01"}', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),

  -- Deposit to ACC10001
  ('850e8400-e29b-41d4-a716-446655440003'::uuid, 'idem-key-003', 'TXN20003', 'DEPOSIT', 'COMPLETED', 100000, 'USD',
   NULL, '750e8400-e29b-41d4-a716-446655440001'::uuid,
   'Salary deposit', '{"category": "salary", "source": "employer"}', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),

  -- Withdrawal from ACC10003
  ('850e8400-e29b-41d4-a716-446655440004'::uuid, 'idem-key-004', 'TXN20004', 'WITHDRAWAL', 'COMPLETED', 5000, 'USD',
   '750e8400-e29b-41d4-a716-446655440003'::uuid, NULL,
   'ATM withdrawal', '{"category": "cash", "atm_id": "ATM12345"}', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  -- Transfer from ACC10004 to ACC10001
  ('850e8400-e29b-41d4-a716-446655440005'::uuid, 'idem-key-005', 'TXN20005', 'TRANSFER', 'COMPLETED', 15000, 'USD',
   '750e8400-e29b-41d4-a716-446655440004'::uuid, '750e8400-e29b-41d4-a716-446655440001'::uuid,
   'Loan repayment', '{"category": "loan", "loan_id": "LOAN123"}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),

  -- Transfer from ACC10002 to ACC10004
  ('850e8400-e29b-41d4-a716-446655440006'::uuid, 'idem-key-006', 'TXN20006', 'TRANSFER', 'COMPLETED', 50000, 'USD',
   '750e8400-e29b-41d4-a716-446655440002'::uuid, '750e8400-e29b-41d4-a716-446655440004'::uuid,
   'Investment transfer', '{"category": "investment", "type": "portfolio"}', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'),

  -- Pending transfer
  ('850e8400-e29b-41d4-a716-446655440007'::uuid, 'idem-key-007', 'TXN20007', 'TRANSFER', 'PENDING', 7500, 'USD',
   '750e8400-e29b-41d4-a716-446655440001'::uuid, '750e8400-e29b-41d4-a716-446655440005'::uuid,
   'Utility payment', '{"category": "utilities", "provider": "Electric Co"}', NOW() - INTERVAL '1 hour', NULL),

  -- Failed transaction
  ('850e8400-e29b-41d4-a716-446655440008'::uuid, 'idem-key-008', 'TXN20008', 'TRANSFER', 'FAILED', 200000, 'USD',
   '750e8400-e29b-41d4-a716-446655440003'::uuid, '750e8400-e29b-41d4-a716-446655440001'::uuid,
   'Large transfer - insufficient funds', '{"category": "transfer", "failure_reason": "insufficient_funds"}', NOW() - INTERVAL '30 minutes', NULL),

  -- Recent deposit
  ('850e8400-e29b-41d4-a716-446655440009'::uuid, 'idem-key-009', 'TXN20009', 'DEPOSIT', 'COMPLETED', 50000, 'USD',
   NULL, '750e8400-e29b-41d4-a716-446655440005'::uuid,
   'Direct deposit', '{"category": "salary", "source": "payroll"}', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),

  -- Recent withdrawal
  ('850e8400-e29b-41d4-a716-446655440010'::uuid, 'idem-key-010', 'TXN20010', 'WITHDRAWAL', 'COMPLETED', 3000, 'USD',
   '750e8400-e29b-41d4-a716-446655440002'::uuid, NULL,
   'ATM withdrawal', '{"category": "cash", "atm_id": "ATM67890"}', NOW(), NOW())
ON CONFLICT (reference_number) DO NOTHING;

-- Insert Ledger Entries (double-entry bookkeeping)
INSERT INTO ledger_entries (id, transaction_id, account_id, entry_type, amount, balance_after, created_at)
VALUES
  -- Transaction 1: Transfer ACC10001 -> ACC10002 (10000 cents = $100.00)
  ('950e8400-e29b-41d4-a716-446655440001'::uuid, '850e8400-e29b-41d4-a716-446655440001'::uuid,
   '750e8400-e29b-41d4-a716-446655440001'::uuid, 'DEBIT', 10000, 490000, NOW() - INTERVAL '5 days'),
  ('950e8400-e29b-41d4-a716-446655440002'::uuid, '850e8400-e29b-41d4-a716-446655440001'::uuid,
   '750e8400-e29b-41d4-a716-446655440002'::uuid, 'CREDIT', 10000, 1010000, NOW() - INTERVAL '5 days'),

  -- Transaction 2: Transfer ACC10002 -> ACC10003 (25000 cents = $250.00)
  ('950e8400-e29b-41d4-a716-446655440003'::uuid, '850e8400-e29b-41d4-a716-446655440002'::uuid,
   '750e8400-e29b-41d4-a716-446655440002'::uuid, 'DEBIT', 25000, 985000, NOW() - INTERVAL '4 days'),
  ('950e8400-e29b-41d4-a716-446655440004'::uuid, '850e8400-e29b-41d4-a716-446655440002'::uuid,
   '750e8400-e29b-41d4-a716-446655440003'::uuid, 'CREDIT', 25000, 275000, NOW() - INTERVAL '4 days'),

  -- Transaction 3: Deposit to ACC10001 (100000 cents = $1000.00)
  ('950e8400-e29b-41d4-a716-446655440005'::uuid, '850e8400-e29b-41d4-a716-446655440003'::uuid,
   '750e8400-e29b-41d4-a716-446655440001'::uuid, 'CREDIT', 100000, 590000, NOW() - INTERVAL '3 days'),

  -- Transaction 4: Withdrawal from ACC10003 (5000 cents = $50.00)
  ('950e8400-e29b-41d4-a716-446655440006'::uuid, '850e8400-e29b-41d4-a716-446655440004'::uuid,
   '750e8400-e29b-41d4-a716-446655440003'::uuid, 'DEBIT', 5000, 270000, NOW() - INTERVAL '2 days'),

  -- Transaction 5: Transfer ACC10004 -> ACC10001 (15000 cents = $150.00)
  ('950e8400-e29b-41d4-a716-446655440007'::uuid, '850e8400-e29b-41d4-a716-446655440005'::uuid,
   '750e8400-e29b-41d4-a716-446655440004'::uuid, 'DEBIT', 15000, 735000, NOW() - INTERVAL '1 day'),
  ('950e8400-e29b-41d4-a716-446655440008'::uuid, '850e8400-e29b-41d4-a716-446655440005'::uuid,
   '750e8400-e29b-41d4-a716-446655440001'::uuid, 'CREDIT', 15000, 605000, NOW() - INTERVAL '1 day'),

  -- Transaction 6: Transfer ACC10002 -> ACC10004 (50000 cents = $500.00)
  ('950e8400-e29b-41d4-a716-446655440009'::uuid, '850e8400-e29b-41d4-a716-446655440006'::uuid,
   '750e8400-e29b-41d4-a716-446655440002'::uuid, 'DEBIT', 50000, 935000, NOW() - INTERVAL '12 hours'),
  ('950e8400-e29b-41d4-a716-446655440010'::uuid, '850e8400-e29b-41d4-a716-446655440006'::uuid,
   '750e8400-e29b-41d4-a716-446655440004'::uuid, 'CREDIT', 50000, 785000, NOW() - INTERVAL '12 hours'),

  -- Transaction 9: Deposit to ACC10005 (50000 cents = $500.00)
  ('950e8400-e29b-41d4-a716-446655440011'::uuid, '850e8400-e29b-41d4-a716-446655440009'::uuid,
   '750e8400-e29b-41d4-a716-446655440005'::uuid, 'CREDIT', 50000, 200000, NOW() - INTERVAL '10 minutes'),

  -- Transaction 10: Withdrawal from ACC10002 (3000 cents = $30.00)
  ('950e8400-e29b-41d4-a716-446655440012'::uuid, '850e8400-e29b-41d4-a716-446655440010'::uuid,
   '750e8400-e29b-41d4-a716-446655440002'::uuid, 'DEBIT', 3000, 932000, NOW());

-- Insert Payment Methods
INSERT INTO payment_methods (id, customer_id, type, provider, provider_token, display_name, last_4_digits, expiry_month, expiry_year, is_default, created_at)
VALUES
  ('a50e8400-e29b-41d4-a716-446655440001'::uuid, '650e8400-e29b-41d4-a716-446655440001'::uuid,
   'CARD', 'stripe', 'tok_visa', 'Visa ending in 4242', '4242', 12, 2027, true, NOW()),
  ('a50e8400-e29b-41d4-a716-446655440002'::uuid, '650e8400-e29b-41d4-a716-446655440002'::uuid,
   'CARD', 'stripe', 'tok_mastercard', 'Mastercard ending in 5555', '5555', 6, 2026, true, NOW()),
  ('a50e8400-e29b-41d4-a716-446655440003'::uuid, '650e8400-e29b-41d4-a716-446655440003'::uuid,
   'CARD', 'stripe', 'tok_amex', 'Amex ending in 1234', '1234', 3, 2028, true, NOW());

-- Verification queries
SELECT 'Users' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers
UNION ALL
SELECT 'Accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'Transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'Ledger Entries', COUNT(*) FROM ledger_entries
UNION ALL
SELECT 'Payment Methods', COUNT(*) FROM payment_methods;

-- Show account balances
SELECT
  a.account_number,
  a.balance / 100.0 AS balance_dollars,
  a.available_balance / 100.0 AS available_balance_dollars,
  a.currency,
  a.status,
  c.customer_code,
  u.email
FROM accounts a
JOIN customers c ON a.customer_id = c.id
JOIN users u ON c.user_id = u.id
ORDER BY a.account_number;

-- Show recent transactions
SELECT
  t.reference_number,
  t.type,
  t.status,
  t.amount / 100.0 AS amount_dollars,
  t.currency,
  from_acc.account_number AS from_account,
  to_acc.account_number AS to_account,
  t.description,
  t.created_at
FROM transactions t
LEFT JOIN accounts from_acc ON t.from_account_id = from_acc.id
LEFT JOIN accounts to_acc ON t.to_account_id = to_acc.id
ORDER BY t.created_at DESC;
