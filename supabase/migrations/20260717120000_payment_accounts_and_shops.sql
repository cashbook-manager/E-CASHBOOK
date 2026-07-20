/*
# Tailor Shop ERP — Shops, Payment Accounts & Money Transactions

## Overview
Introduces multi-branch (multi-shop) support and a proper "money location" model so every
income/expense in the app (order payments, sales, worker salaries, expenses) can be tied to
exactly where the money physically sits: a cash drawer, a bank account, or a POS machine.

## New tables
1. `shops` — physical branches/locations (e.g. "Shop 1", "Shop 2"). Seeded with one default
   shop so existing single-branch installs keep working without any data loss.
2. `payment_accounts` — cash / bank / POS "money accounts" that belong to a shop.
   type: cash | bank | pos. status: available | disabled.
3. `money_transactions` — single ledger of every money movement across the whole business.
   direction: in (taking money) | out (giving money).
   source_type: order | sale | salary | expense | advance | manual — tells you which
   business event produced the row; source_id points back at that row's primary key.
   This table is what branch Reports and the master Cashbook are aggregated from.

## Changes to existing tables
`orders`, `cashbook`, `worker_final_payments`, `worker_advances`, `salesman_salary_ledger`,
and `salesman_advances` each get two new nullable columns:
  - `shop_id`        → which branch the transaction belongs to
  - `payment_account_id` → which cash/bank/POS account the money moved through
Both are nullable so existing rows keep working; a backfill below points existing rows at the
default shop's default cash account.

## Security
- RLS enabled on every new table.
- `TO anon, authenticated` CRUD policies, matching the rest of this single-tenant app.
*/

-- ---------------------------------------------------------------------------
-- Shops (branches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  phone text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_shops" ON shops;
CREATE POLICY "anon_select_shops" ON shops FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_shops" ON shops;
CREATE POLICY "anon_insert_shops" ON shops FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_shops" ON shops;
CREATE POLICY "anon_update_shops" ON shops FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_shops" ON shops;
CREATE POLICY "anon_delete_shops" ON shops FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Payment accounts (cash / bank / POS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cash', 'bank', 'pos')),
  name text NOT NULL,
  bank_name text DEFAULT '',
  account_number text DEFAULT '',
  pos_machine_id text DEFAULT '',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'disabled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_select_payment_accounts" ON payment_accounts FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_insert_payment_accounts" ON payment_accounts FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_update_payment_accounts" ON payment_accounts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_payment_accounts" ON payment_accounts;
CREATE POLICY "anon_delete_payment_accounts" ON payment_accounts FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Money transactions (unified ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS money_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  payment_account_id uuid NOT NULL REFERENCES payment_accounts(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount numeric(12,3) NOT NULL DEFAULT 0,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('order', 'sale', 'salary', 'expense', 'advance', 'manual')),
  source_id uuid,
  category text DEFAULT '',
  notes text DEFAULT '',
  entry_date date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE money_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_money_transactions" ON money_transactions;
CREATE POLICY "anon_select_money_transactions" ON money_transactions FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_money_transactions" ON money_transactions;
CREATE POLICY "anon_insert_money_transactions" ON money_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_money_transactions" ON money_transactions;
CREATE POLICY "anon_update_money_transactions" ON money_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_money_transactions" ON money_transactions;
CREATE POLICY "anon_delete_money_transactions" ON money_transactions FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Link columns on existing money-touching tables
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN shop_id uuid REFERENCES shops(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN payment_account_id uuid REFERENCES payment_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE cashbook ADD COLUMN shop_id uuid REFERENCES shops(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE cashbook ADD COLUMN payment_account_id uuid REFERENCES payment_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE worker_final_payments ADD COLUMN shop_id uuid REFERENCES shops(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE worker_final_payments ADD COLUMN payment_account_id uuid REFERENCES payment_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE worker_advances ADD COLUMN shop_id uuid REFERENCES shops(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE worker_advances ADD COLUMN payment_account_id uuid REFERENCES payment_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE salesman_salary_ledger ADD COLUMN shop_id uuid REFERENCES shops(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE salesman_salary_ledger ADD COLUMN payment_account_id uuid REFERENCES payment_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE salesman_advances ADD COLUMN shop_id uuid REFERENCES shops(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE salesman_advances ADD COLUMN payment_account_id uuid REFERENCES payment_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Seed: default shop + default cash account, backfill existing rows
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  default_shop_id uuid;
  default_cash_id uuid;
BEGIN
  SELECT id INTO default_shop_id FROM shops ORDER BY created_at LIMIT 1;

  IF default_shop_id IS NULL THEN
    INSERT INTO shops (name, status) VALUES ('Main Shop', 'active')
    RETURNING id INTO default_shop_id;
  END IF;

  SELECT id INTO default_cash_id FROM payment_accounts
    WHERE shop_id = default_shop_id AND type = 'cash' LIMIT 1;

  IF default_cash_id IS NULL THEN
    INSERT INTO payment_accounts (shop_id, type, name, status)
      VALUES (default_shop_id, 'cash', 'Main Cash', 'available')
      RETURNING id INTO default_cash_id;
  END IF;

  UPDATE orders SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE orders SET payment_account_id = default_cash_id WHERE payment_account_id IS NULL;

  UPDATE cashbook SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE cashbook SET payment_account_id = default_cash_id WHERE payment_account_id IS NULL;

  UPDATE worker_final_payments SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE worker_final_payments SET payment_account_id = default_cash_id WHERE payment_account_id IS NULL;

  UPDATE worker_advances SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE worker_advances SET payment_account_id = default_cash_id WHERE payment_account_id IS NULL;

  UPDATE salesman_salary_ledger SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE salesman_salary_ledger SET payment_account_id = default_cash_id WHERE payment_account_id IS NULL;

  UPDATE salesman_advances SET shop_id = default_shop_id WHERE shop_id IS NULL;
  UPDATE salesman_advances SET payment_account_id = default_cash_id WHERE payment_account_id IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_accounts_shop ON payment_accounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_money_transactions_shop ON money_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_money_transactions_account ON money_transactions(payment_account_id);
CREATE INDEX IF NOT EXISTS idx_money_transactions_source ON money_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_money_transactions_date ON money_transactions(entry_date);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_account ON orders(payment_account_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_shop ON cashbook(shop_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_payment_account ON cashbook(payment_account_id);
