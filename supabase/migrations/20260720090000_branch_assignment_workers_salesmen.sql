/*
  # Branch assignment for workers & salesmen

  Adds `shop_id` to `workers` and `salesmen` so each person can optionally be
  assigned to a specific branch. This lets the app filter every module
  (Orders, Salesmen, Workers, Cashbook, Transactions, Dashboard) by branch.

  Existing rows are left with shop_id = null ("Unassigned"), which shows up
  under every branch until reassigned from the UI so nothing disappears.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workers' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE workers ADD COLUMN shop_id uuid REFERENCES shops(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'salesmen' AND column_name = 'shop_id'
  ) THEN
    ALTER TABLE salesmen ADD COLUMN shop_id uuid REFERENCES shops(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workers_shop_id ON workers(shop_id);
CREATE INDEX IF NOT EXISTS idx_salesmen_shop_id ON salesmen(shop_id);
