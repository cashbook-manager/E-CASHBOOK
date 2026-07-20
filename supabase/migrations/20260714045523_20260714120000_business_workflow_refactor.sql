/*
# Tailor Shop ERP — Business Workflow Refactor

## Overview
Refactors schema to match real business workflow: separate tailoring/readymade/fabric sales,
worker salary advances, salesman salary advances, opening cash, new order statuses.

## Changes to existing tables
1. `settings` — add `opening_cash` numeric default 0
2. `orders` — add `sale_type` text default 'tailoring' (tailoring | readymade | fabric)
3. `orders` — add `additional_payment` numeric default 0
4. `workers` — add `monthly_salary` numeric default 0
5. `salesmen` — add `commission` numeric default 0
6. `salesman_salary_ledger` — add `type` text default 'payment' (advance | payment)

## New tables
7. `worker_advances` — early salary payments to workers
8. `salesman_advances` — early salary payments to salesmen

## Security
- RLS enabled on all new tables with anon, authenticated CRUD policies.
*/

-- 1. settings: opening_cash
DO $$ BEGIN
  ALTER TABLE settings ADD COLUMN opening_cash numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. orders: sale_type, additional_payment
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN sale_type text DEFAULT 'tailoring';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN additional_payment numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. workers: monthly_salary
DO $$ BEGIN
  ALTER TABLE workers ADD COLUMN monthly_salary numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 4. salesmen: commission
DO $$ BEGIN
  ALTER TABLE salesmen ADD COLUMN commission numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 5. salesman_salary_ledger: type column
DO $$ BEGIN
  ALTER TABLE salesman_salary_ledger ADD COLUMN type text DEFAULT 'payment';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 6. worker_advances table
CREATE TABLE IF NOT EXISTS worker_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  amount numeric(12,3) NOT NULL DEFAULT 0,
  advance_date date DEFAULT now(),
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE worker_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_worker_advances" ON worker_advances;
CREATE POLICY "anon_select_worker_advances" ON worker_advances FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_worker_advances" ON worker_advances;
CREATE POLICY "anon_insert_worker_advances" ON worker_advances FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_worker_advances" ON worker_advances;
CREATE POLICY "anon_update_worker_advances" ON worker_advances FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_worker_advances" ON worker_advances;
CREATE POLICY "anon_delete_worker_advances" ON worker_advances FOR DELETE
  TO anon, authenticated USING (true);

-- 7. salesman_advances table
CREATE TABLE IF NOT EXISTS salesman_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_id uuid REFERENCES salesmen(id) ON DELETE CASCADE,
  amount numeric(12,3) NOT NULL DEFAULT 0,
  advance_date date DEFAULT now(),
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE salesman_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_salesman_advances" ON salesman_advances;
CREATE POLICY "anon_select_salesman_advances" ON salesman_advances FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_salesman_advances" ON salesman_advances;
CREATE POLICY "anon_insert_salesman_advances" ON salesman_advances FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_salesman_advances" ON salesman_advances;
CREATE POLICY "anon_update_salesman_advances" ON salesman_advances FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_salesman_advances" ON salesman_advances;
CREATE POLICY "anon_delete_salesman_advances" ON salesman_advances FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_worker_advances_worker ON worker_advances(worker_id);
CREATE INDEX IF NOT EXISTS idx_salesman_advances_salesman ON salesman_advances(salesman_id);
CREATE INDEX IF NOT EXISTS idx_orders_sale_type ON orders(sale_type);
