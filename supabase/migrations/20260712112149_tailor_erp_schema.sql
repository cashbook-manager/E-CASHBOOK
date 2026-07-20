/*
# Tailor Shop ERP — Core Schema

## Overview
Single-tenant ERP for a tailor shop. Two in-app user roles (Admin, Salesman) but NO Supabase Auth sign-in is required
for the main app — the shop owner uses the app directly. Salesmen get read-only share links generated per salesman.
Therefore all tables use `TO anon, authenticated` policies so the anon-key frontend can operate.

## Tables created
1. `settings` — single row holding shop info, currency, theme, reminder days.
2. `workers` — unlimited workers across categories (embroidery, rhinestone, stitching, cutting).
3. `worker_designs` — design numbers, only for embroidery workers.
4. `salesmen` — unlimited salesmen with monthly salary + share token.
5. `salesman_salary_ledger` — salary take history per salesman.
6. `orders` — the core order record with receipt number, customer, amounts, status, salesman.
7. `order_workers` — many-to-many assignment of workers to an order by category.
8. `order_timeline` — append-only history of every action on an order.
9. `worker_payments` — per-submission payments (design number, receipt, qty, amount).
10. `worker_final_payments` — final settlement payments per worker.
11. `cashbook` — daily income/expense entries.
12. `storage` bucket `receipts` for uploaded receipt images.

## Security
- RLS enabled on every table.
- `TO anon, authenticated` CRUD policies (single-tenant, intentionally shared).
- Storage bucket `receipts` public for reads (so share links can render thumbnails), writes via anon.
*/

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id smallint PRIMARY KEY DEFAULT 1,
  shop_name text NOT NULL DEFAULT 'My Tailor Shop',
  owner_name text NOT NULL DEFAULT 'Owner',
  phone text DEFAULT '',
  whatsapp text DEFAULT '',
  address text DEFAULT '',
  currency text NOT NULL DEFAULT 'OMR',
  theme text NOT NULL DEFAULT 'light',
  profile_photo text DEFAULT '',
  logo text DEFAULT '',
  reminder_days int NOT NULL DEFAULT 7,
  CONSTRAINT settings_singleton CHECK (id = 1)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Workers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text DEFAULT '',
  category text NOT NULL DEFAULT 'embroidery',
  photo text DEFAULT '',
  join_date date DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_workers" ON workers;
CREATE POLICY "anon_select_workers" ON workers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_workers" ON workers;
CREATE POLICY "anon_insert_workers" ON workers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_workers" ON workers;
CREATE POLICY "anon_update_workers" ON workers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_workers" ON workers;
CREATE POLICY "anon_delete_workers" ON workers FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Worker designs (embroidery only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  design_number text NOT NULL,
  design_name text DEFAULT '',
  price numeric(12,3) DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE worker_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_worker_designs" ON worker_designs;
CREATE POLICY "anon_select_worker_designs" ON worker_designs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_worker_designs" ON worker_designs;
CREATE POLICY "anon_insert_worker_designs" ON worker_designs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_worker_designs" ON worker_designs;
CREATE POLICY "anon_update_worker_designs" ON worker_designs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_worker_designs" ON worker_designs;
CREATE POLICY "anon_delete_worker_designs" ON worker_designs FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Salesmen
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salesmen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text DEFAULT '',
  photo text DEFAULT '',
  monthly_salary numeric(12,3) DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  share_token text UNIQUE NOT NULL DEFAULT substr(md5(random()::text),1,10),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE salesmen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_salesmen" ON salesmen;
CREATE POLICY "anon_select_salesmen" ON salesmen FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_salesmen" ON salesmen;
CREATE POLICY "anon_insert_salesmen" ON salesmen FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_salesmen" ON salesmen;
CREATE POLICY "anon_update_salesmen" ON salesmen FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_salesmen" ON salesmen;
CREATE POLICY "anon_delete_salesmen" ON salesmen FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Salesman salary ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salesman_salary_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salesman_id uuid REFERENCES salesmen(id) ON DELETE CASCADE,
  amount numeric(12,3) NOT NULL DEFAULT 0,
  payment_date date DEFAULT now(),
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE salesman_salary_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ssl" ON salesman_salary_ledger;
CREATE POLICY "anon_select_ssl" ON salesman_salary_ledger FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ssl" ON salesman_salary_ledger;
CREATE POLICY "anon_insert_ssl" ON salesman_salary_ledger FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ssl" ON salesman_salary_ledger;
CREATE POLICY "anon_update_ssl" ON salesman_salary_ledger FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ssl" ON salesman_salary_ledger;
CREATE POLICY "anon_delete_ssl" ON salesman_salary_ledger FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL,
  customer_name text NOT NULL,
  whatsapp_number text DEFAULT '',
  order_type text DEFAULT '',
  order_date date DEFAULT now(),
  delivery_date date,
  total_amount numeric(12,3) DEFAULT 0,
  advance numeric(12,3) DEFAULT 0,
  balance numeric(12,3) GENERATED ALWAYS AS (total_amount - advance) STORED,
  measurement text DEFAULT '',
  notes text DEFAULT '',
  receipt_image text DEFAULT '',
  salesman_id uuid REFERENCES salesmen(id) ON DELETE SET NULL,
  priority text DEFAULT 'normal',
  remarks text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Order workers (assignment + submission)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  category text NOT NULL,
  submitted boolean NOT NULL DEFAULT false,
  submission_date timestamptz,
  submission_remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_workers" ON order_workers;
CREATE POLICY "anon_select_order_workers" ON order_workers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_workers" ON order_workers;
CREATE POLICY "anon_insert_order_workers" ON order_workers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_workers" ON order_workers;
CREATE POLICY "anon_update_order_workers" ON order_workers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_workers" ON order_workers;
CREATE POLICY "anon_delete_order_workers" ON order_workers FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Order timeline (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail text DEFAULT '',
  person text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_timeline" ON order_timeline;
CREATE POLICY "anon_select_order_timeline" ON order_timeline FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_timeline" ON order_timeline;
CREATE POLICY "anon_insert_order_timeline" ON order_timeline FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_timeline" ON order_timeline;
CREATE POLICY "anon_delete_order_timeline" ON order_timeline FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Worker payments (per submission)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  design_number text DEFAULT '',
  receipt_number text DEFAULT '',
  submission_date date DEFAULT now(),
  price numeric(12,3) DEFAULT 0,
  quantity int DEFAULT 1,
  amount numeric(12,3) DEFAULT 0,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE worker_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_worker_payments" ON worker_payments;
CREATE POLICY "anon_select_worker_payments" ON worker_payments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_worker_payments" ON worker_payments;
CREATE POLICY "anon_insert_worker_payments" ON worker_payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_worker_payments" ON worker_payments;
CREATE POLICY "anon_update_worker_payments" ON worker_payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_worker_payments" ON worker_payments;
CREATE POLICY "anon_delete_worker_payments" ON worker_payments FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Worker final payments (settlements)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS worker_final_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE,
  total_earned numeric(12,3) DEFAULT 0,
  discount numeric(12,3) DEFAULT 0,
  final_amount numeric(12,3) DEFAULT 0,
  payment_method text DEFAULT 'cash',
  remarks text DEFAULT '',
  payment_date date DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE worker_final_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wfp" ON worker_final_payments;
CREATE POLICY "anon_select_wfp" ON worker_final_payments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_wfp" ON worker_final_payments;
CREATE POLICY "anon_insert_wfp" ON worker_final_payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_wfp" ON worker_final_payments;
CREATE POLICY "anon_update_wfp" ON worker_final_payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_wfp" ON worker_final_payments;
CREATE POLICY "anon_delete_wfp" ON worker_final_payments FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Cashbook
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date DEFAULT now(),
  type text NOT NULL DEFAULT 'income',
  category text DEFAULT 'miscellaneous',
  amount numeric(12,3) DEFAULT 0,
  notes text DEFAULT '',
  attachment text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cashbook ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cashbook" ON cashbook;
CREATE POLICY "anon_select_cashbook" ON cashbook FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cashbook" ON cashbook;
CREATE POLICY "anon_insert_cashbook" ON cashbook FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cashbook" ON cashbook;
CREATE POLICY "anon_update_cashbook" ON cashbook FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cashbook" ON cashbook;
CREATE POLICY "anon_delete_cashbook" ON cashbook FOR DELETE
  TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_receipt ON orders(receipt_number);
CREATE INDEX IF NOT EXISTS idx_orders_salesman ON orders(salesman_id);
CREATE INDEX IF NOT EXISTS idx_order_workers_order ON order_workers(order_id);
CREATE INDEX IF NOT EXISTS idx_order_workers_worker ON order_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_payments_worker ON worker_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook(entry_date);
CREATE INDEX IF NOT EXISTS idx_ssl_salesman ON salesman_salary_ledger(salesman_id);
CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for receipts
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_receipts" ON storage.objects;
CREATE POLICY "anon_read_receipts" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'receipts');
DROP POLICY IF EXISTS "anon_write_receipts" ON storage.objects;
CREATE POLICY "anon_write_receipts" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'receipts');
DROP POLICY IF EXISTS "anon_update_receipts" ON storage.objects;
CREATE POLICY "anon_update_receipts" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'receipts') WITH CHECK (bucket_id = 'receipts');
DROP POLICY IF EXISTS "anon_delete_receipts" ON storage.objects;
CREATE POLICY "anon_delete_receipts" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'receipts');