/*
# Delivery Payment Confirmation & Loss Tracking

## Overview
Previously, marking an order "Delivered" silently assumed the customer paid the
entire remaining balance. This migration adds the fields needed to record what
the customer *actually* paid at the moment of delivery, and to track any gap
between that payment and the order's balance — either as an outstanding
receivable (to be collected later) or as a written-off loss (discount, goodwill,
complaint, etc).

## Changes to `orders`
- `customer_paid_now`   numeric — amount the customer paid at delivery time
- `remaining_balance`   numeric — balance still owed after the delivery payment
                          (0 once paid in full or written off)
- `payment_status`      text    — 'unpaid' | 'paid_in_full' | 'outstanding' | 'written_off'
- `loss_amount`         numeric — amount written off as a loss, if any
- `loss_reason`         text    — reason selected for a write-off
- `write_off`           boolean — true if the unpaid remainder was written off
- `delivered_date`      date    — actual date the order was delivered/confirmed
- `payment_method`      text    — how today's payment was received (cash / bank / pos / other)

## Backfill
Orders already marked 'delivered' before this migration are backfilled as
'paid_in_full' with customer_paid_now set to their existing balance, so
historical dashboard numbers don't suddenly drop to zero.

## Security
No RLS changes — these are plain columns on the existing `orders` table, which
already has anon/authenticated CRUD policies.
*/

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN customer_paid_now numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN remaining_balance numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('unpaid', 'paid_in_full', 'outstanding', 'written_off'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN loss_amount numeric(12,3) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN loss_reason text DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN write_off boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN delivered_date date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN payment_method text DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill existing delivered orders so historical reporting stays consistent.
UPDATE orders
SET
  payment_status = 'paid_in_full',
  customer_paid_now = COALESCE(total_amount, 0) - COALESCE(advance, 0) - COALESCE(additional_payment, 0),
  remaining_balance = 0,
  delivered_date = COALESCE(delivered_date, updated_at::date)
WHERE status = 'delivered' AND payment_status = 'unpaid';

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
