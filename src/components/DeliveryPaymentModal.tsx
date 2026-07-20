import { useMemo, useState } from 'react';
import { Wallet, Landmark, CreditCard, MoreHorizontal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { recordTransaction } from '../lib/transactions';
import { usePaymentAccounts } from '../lib/hooks';
import { fmtMoney, todayISO } from '../lib/format';
import type { DeliveryPaymentMethod, LossReason, Order, Settings } from '../lib/types';
import { Modal, Button, Field, Input, Select, PaymentAccountSelect } from './ui';

const LOSS_REASONS: LossReason[] = [
  'Customer Discount',
  'Late Delivery Compensation',
  'Design Issue',
  'Customer Complaint',
  'Other',
];

const METHODS: { value: DeliveryPaymentMethod; label: string; icon: typeof Wallet }[] = [
  { value: 'cash', label: 'Cash', icon: Wallet },
  { value: 'bank', label: 'Bank Transfer', icon: Landmark },
  { value: 'pos', label: 'POS / Card', icon: CreditCard },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function DeliveryPaymentModal({
  order, settings, onClose, onConfirmed,
}: {
  order: Order;
  settings: Settings | null;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const currency = settings?.currency || 'OMR';
  const { shops, accounts } = usePaymentAccounts();

  const [step, setStep] = useState<'confirm' | 'shortfall'>('confirm');
  const [paidNow, setPaidNow] = useState('');
  const [method, setMethod] = useState<DeliveryPaymentMethod>('cash');
  const [accountId, setAccountId] = useState(order.payment_account_id || '');
  const [choice, setChoice] = useState<'outstanding' | 'writeoff' | null>(null);
  const [reason, setReason] = useState<LossReason | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Balance actually still owed by the customer before today's payment:
  // total - advance already taken - any additional payment already recorded.
  const dueBalance = round3(
    Math.max(0, Number(order.total_amount) - Number(order.advance) - Number(order.additional_payment || 0))
  );

  const paidNowNum = round3(Number(paidNow) || 0);
  const remaining = round3(Math.max(0, dueBalance - paidNowNum));

  const filteredAccounts = useMemo(
    () => (method === 'other' ? accounts : accounts.filter((a) => a.type === method)),
    [accounts, method]
  );

  const selectedAccount = accounts.find((a) => a.id === accountId);

  async function writeTimeline(action: string, detail: string) {
    await supabase.from('order_timeline').insert({
      order_id: order.id, action, detail, person: 'Admin',
    });
  }

  async function finalize(finalStatus: 'paid_in_full' | 'outstanding' | 'written_off') {
    setSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const lossAmount = finalStatus === 'written_off' ? remaining : 0;
      const finalReason = finalStatus === 'written_off' ? (reason === 'Other' ? `Other: ${note}` : reason) : '';

      const patch: any = {
        status: 'delivered',
        updated_at: now,
        delivered_date: todayISO(),
        customer_paid_now: paidNowNum,
        remaining_balance: finalStatus === 'outstanding' ? remaining : 0,
        payment_status: finalStatus,
        loss_amount: lossAmount,
        loss_reason: finalReason,
        write_off: finalStatus === 'written_off',
        payment_method: method,
        payment_account_id: accountId || order.payment_account_id,
      };

      await supabase.from('orders').update(patch).eq('id', order.id);

      if (paidNowNum > 0.0005 && selectedAccount) {
        await recordTransaction({
          shop_id: selectedAccount.shop_id, payment_account_id: selectedAccount.id,
          direction: 'in', amount: paidNowNum,
          source_type: 'order', source_id: order.id,
          category: 'delivered_payment',
          notes: `${order.receipt_number} · ${order.customer_name} · Delivery payment (${method})`,
        });
      }

      if (finalStatus === 'paid_in_full') {
        await writeTimeline('Delivered — Paid in Full', `Customer paid ${fmtMoney(paidNowNum, currency)} via ${method}. Balance cleared.`);
      } else if (finalStatus === 'outstanding') {
        await writeTimeline('Delivered — Balance Outstanding', `Customer paid ${fmtMoney(paidNowNum, currency)} via ${method}. ${fmtMoney(remaining, currency)} kept as pending receivable.`);
      } else {
        await writeTimeline('Delivered — Written Off as Loss', `Customer paid ${fmtMoney(paidNowNum, currency)} via ${method}. ${fmtMoney(remaining, currency)} written off (${finalReason}).`);
      }

      onConfirmed();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleConfirmPayment() {
    setError('');
    if (paidNowNum > 0.0005 && !accountId) {
      setError('Please select which account received the payment.');
      return;
    }
    if (remaining <= 0.0005) {
      finalize('paid_in_full');
    } else {
      setStep('shortfall');
    }
  }

  function handleWriteOffConfirm() {
    if (!reason) {
      setError('Please select a reason for the write-off.');
      return;
    }
    if (reason === 'Other' && !note.trim()) {
      setError('Please add a note explaining the write-off.');
      return;
    }
    setError('');
    finalize('written_off');
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Confirm Delivery & Payment"
      size="md"
      footer={
        step === 'confirm' ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirmPayment} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        ) : choice === 'writeoff' ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setChoice(null)}>Back</Button>
            <Button variant="danger" onClick={handleWriteOffConfirm} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm Write-Off'}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setStep('confirm')} disabled={saving}>Back</Button>
          </div>
        )
      }
    >
      {step === 'confirm' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryRow label="Receipt Number" value={order.receipt_number} />
            <SummaryRow label="Customer Name" value={order.customer_name} />
            <SummaryRow label="Total Amount" value={fmtMoney(order.total_amount, currency)} />
            <SummaryRow label="Advance Paid" value={fmtMoney(Number(order.advance) + Number(order.additional_payment || 0), currency)} />
            <div className="col-span-2">
              <SummaryRow label="Current Balance" value={fmtMoney(dueBalance, currency)} highlight />
            </div>
          </div>

          <Field label="Customer Paid Now">
            <Input
              type="number" step="0.001" min="0" autoFocus
              value={paidNow}
              onChange={(e) => setPaidNow(e.target.value)}
              placeholder="0.000"
            />
          </Field>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-semibold">Remaining Balance</span>
            <span className={`font-bold ${remaining > 0.0005 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {fmtMoney(remaining, currency)}
            </span>
          </div>

          <div>
            <p className="label mb-1.5">Where was today's payment received?</p>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { setMethod(m.value); setAccountId(''); }}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition ${
                      method === m.value
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon size={16} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Payment Account">
            <PaymentAccountSelect
              shops={shops} accounts={filteredAccounts} value={accountId} onChange={setAccountId}
              placeholder="Select account that received this payment"
            />
          </Field>

          {error && <p className="text-sm text-rose-500">{error}</p>}
        </div>
      ) : choice === null ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 flex gap-3">
            <AlertTriangle className="text-amber-500 flex-shrink-0" size={20} />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              Customer still has {fmtMoney(remaining, currency)} unpaid. What would you like to do?
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => finalize('outstanding')}
              disabled={saving}
              className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-sky-400 text-left transition disabled:opacity-60"
            >
              <p className="font-bold text-sm">Keep as Outstanding</p>
              <p className="text-xs text-slate-500 mt-1">Order is delivered. {fmtMoney(remaining, currency)} stays as a pending receivable the customer can pay later.</p>
            </button>
            <button
              onClick={() => setChoice('writeoff')}
              disabled={saving}
              className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-rose-400 text-left transition disabled:opacity-60"
            >
              <p className="font-bold text-sm">Write Off as Loss</p>
              <p className="text-xs text-slate-500 mt-1">Order is delivered. {fmtMoney(remaining, currency)} is recorded as a loss instead of a receivable.</p>
            </button>
          </div>
          {saving && <p className="text-sm text-slate-500">Saving…</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Recording {fmtMoney(remaining, currency)} as a loss for this order. Please select a reason.
          </p>
          <Field label="Reason">
            <Select value={reason} onChange={(e) => setReason(e.target.value as LossReason)}>
              <option value="">— Select a reason —</option>
              {LOSS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          {reason === 'Other' && (
            <Field label="Note">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain the write-off…" />
            </Field>
          )}
          {error && <p className="text-sm text-rose-500">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-2.5 rounded-lg ${highlight ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
      <p className="text-xs text-slate-500 font-semibold uppercase">{label}</p>
      <p className={`font-semibold mt-0.5 ${highlight ? 'text-sky-700 dark:text-sky-400 text-lg' : ''}`}>{value}</p>
    </div>
  );
}
