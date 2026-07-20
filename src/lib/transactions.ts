import { supabase } from './supabase';
import type { MoneyTransaction } from './types';

export type RecordTransactionInput = {
  shop_id: string;
  payment_account_id: string;
  direction: 'in' | 'out';
  amount: number;
  source_type: MoneyTransaction['source_type'];
  source_id?: string | null;
  category?: string;
  notes?: string;
  entry_date?: string;
};

/**
 * Records a single money movement against the unified ledger (`money_transactions`).
 * Call this any time money is taken or given: order payments, sales, worker/salesman
 * salaries and advances, and expenses. The Cashbook and branch Reports both read from
 * this table, so every payment flow should write through here.
 */
export async function recordTransaction(input: RecordTransactionInput) {
  const { data, error } = await supabase
    .from('money_transactions')
    .insert({
      shop_id: input.shop_id,
      payment_account_id: input.payment_account_id,
      direction: input.direction,
      amount: Number(input.amount) || 0,
      source_type: input.source_type,
      source_id: input.source_id ?? null,
      category: input.category ?? '',
      notes: input.notes ?? '',
      entry_date: input.entry_date ?? new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MoneyTransaction;
}
