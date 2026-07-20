import { useEffect, useState } from 'react';
import { Plus, BookOpen, TrendingUp, TrendingDown, FileSpreadsheet, Pencil, Trash2, Banknote, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CashbookEntry, MoneyTransaction } from '../lib/types';
import { Card, Button, Input, Select, Field, Textarea, Modal, EmptyState, Spinner, StatCard, PaymentAccountSelect, Badge } from '../components/ui';
import { fmtMoney, fmtDate, todayISO, exportCSV } from '../lib/format';
import { useSettings, useSelectedBranch, filterByBranch } from '../lib/store';
import { usePaymentAccounts } from '../lib/hooks';
import { recordTransaction } from '../lib/transactions';

const INCOME_CATEGORIES = ['customer_advance', 'delivered_payment', 'readymade_sale', 'fabric_sale', 'other_income'];
const EXPENSE_CATEGORIES = ['worker_advance', 'worker_salary', 'salesman_advance', 'salesman_salary', 'electricity', 'rent', 'water', 'internet', 'fuel', 'transport', 'maintenance', 'office', 'miscellaneous'];

export function Cashbook() {
  const settings = useSettings();
  const currency = settings?.currency || 'OMR';
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashbookEntry | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const { branch } = useSelectedBranch();

  function refresh() {
    supabase.from('cashbook').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => { setEntries((data as CashbookEntry[]) || []); setLoading(false); });
  }

  useEffect(() => { refresh(); }, []);

  const branchEntries = filterByBranch(entries, branch);
  const filtered = filterType === 'all' ? branchEntries : branchEntries.filter((e) => e.type === filterType);
  const totalIncome = branchEntries.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const totalExpense = branchEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-4 animate-fade">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">Cash Drawer</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={18} /> New Entry</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Cash In" value={fmtMoney(totalIncome, currency)} icon={<TrendingUp size={18} />} accent="emerald" />
        <StatCard label="Cash Out" value={fmtMoney(totalExpense, currency)} icon={<TrendingDown size={18} />} accent="rose" />
        <StatCard label="Net Balance" value={fmtMoney(net, currency)} icon={<Banknote size={18} />} accent={net >= 0 ? 'sky' : 'rose'} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition ${
                filterType === t ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => exportCashbook(filtered, currency)}><FileSpreadsheet size={16} /> Export</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<BookOpen />} title="No entries yet" subtitle="Record your first income or expense" /></Card>
      ) : (
        <div className="space-y-1">
          {filtered.map((e) => (
            <Card key={e.id} className="p-3 flex items-center gap-3 hover:shadow-sm transition">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                e.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {e.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{e.notes || e.category.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-500">{fmtDate(e.entry_date)} · {e.category.replace(/_/g, ' ')}</p>
              </div>
              <span className={`font-bold text-sm ${e.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                {e.type === 'income' ? '+' : '-'}{fmtMoney(e.amount, currency)}
              </span>
              <button onClick={() => { setEditing(e); setFormOpen(true); }} className="text-sky-600 hover:text-sky-500 text-xs font-semibold flex items-center gap-1"><Pencil size={13} /></button>
              <button onClick={async () => { if (confirm('Delete this entry?')) { await supabase.from('cashbook').delete().eq('id', e.id); await supabase.from('money_transactions').delete().eq('source_type', 'manual').eq('source_id', e.id); refresh(); } }} className="text-rose-500 hover:text-rose-400 text-xs font-semibold flex items-center gap-1"><Trash2 size={13} /></button>
            </Card>
          ))}
        </div>
      )}

      {formOpen && <EntryForm entry={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); refresh(); }} />}

      <TransactionsLedger currency={currency} />
    </div>
  );
}

type TxnRow = MoneyTransaction & { shop?: { name: string } | null; payment_account?: { name: string; type: string } | null };

function TransactionsLedger({ currency }: { currency: string }) {
  const { shops } = usePaymentAccounts();
  const { branch } = useSelectedBranch();
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopFilter, setShopFilter] = useState(branch);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'bank' | 'pos'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Follow the header's branch switcher by default; the dropdown below still lets you override it.
  useEffect(() => { setShopFilter(branch); }, [branch]);

  function refresh() {
    setLoading(true);
    supabase
      .from('money_transactions')
      .select('*, shop:shops(name), payment_account:payment_accounts(name,type)')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTxns((data as TxnRow[]) || []); setLoading(false); });
  }

  useEffect(() => { refresh(); }, []);

  const filtered = txns.filter((t) => {
    if (shopFilter !== 'all' && t.shop_id !== shopFilter) return false;
    if (paymentFilter !== 'all' && t.payment_account?.type !== paymentFilter) return false;
    if (from && t.entry_date < from) return false;
    if (to && t.entry_date > to) return false;
    return true;
  });

  async function deleteTxn(t: TxnRow) {
    const sourceNote = t.source_type && t.source_type !== 'manual'
      ? ` This entry is linked to a ${t.source_type.replace(/_/g, ' ')} record — deleting it here only removes it from the cashbook ledger, it will NOT undo the related order/salary record.`
      : '';
    if (!confirm(`Delete this transaction? This cannot be undone.${sourceNote}`)) return;
    await supabase.from('money_transactions').delete().eq('id', t.id);
    refresh();
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Filter size={16} className="text-sky-600" /> All Transactions
        </div>
        <Button variant="ghost" onClick={() => exportCSV('transactions.csv', [
          ['Date', 'Branch', 'Account', 'Type', 'Direction', 'Amount', 'Notes'],
          ...filtered.map((t) => [fmtDate(t.entry_date), t.shop?.name || '', t.payment_account?.name || '', t.payment_account?.type || '', t.direction === 'in' ? 'Taking' : 'Giving', t.amount, t.notes]),
        ])}><FileSpreadsheet size={16} /> Export</Button>
      </div>

      <div className="p-4 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        <Select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)} className="w-auto">
          <option value="all">All Branches</option>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <div className="flex gap-1">
          {(['all', 'cash', 'bank', 'pos'] as const).map((p) => (
            <button key={p} onClick={() => setPaymentFilter(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase transition ${
                paymentFilter === p ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <span className="self-center text-slate-400 text-sm">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="text-sky-600" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Banknote />} title="No transactions" subtitle="Payments recorded through orders, salaries, and expenses will show up here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 px-4 font-semibold">Date</th>
                <th className="py-2 px-4 font-semibold">Branch</th>
                <th className="py-2 px-4 font-semibold">Account</th>
                <th className="py-2 px-4 font-semibold">Notes</th>
                <th className="py-2 px-4 font-semibold text-right">Amount</th>
                <th className="py-2 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="py-2.5 px-4">{fmtDate(t.entry_date)}</td>
                  <td className="py-2.5 px-4">{t.shop?.name || '—'}</td>
                  <td className="py-2.5 px-4">
                    {t.payment_account?.name || '—'}
                    {t.payment_account?.type && <Badge color={t.payment_account.type === 'cash' ? 'green' : t.payment_account.type === 'bank' ? 'blue' : 'amber'} className="ml-2">{t.payment_account.type.toUpperCase()}</Badge>}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 truncate max-w-[220px]">{t.notes || t.category.replace(/_/g, ' ')}</td>
                  <td className={`py-2.5 px-4 text-right font-bold ${t.direction === 'in' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {t.direction === 'in' ? '+' : '-'}{fmtMoney(t.amount, currency)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => deleteTxn(t)}
                      title="Delete transaction"
                      className="text-rose-500 hover:text-rose-400 inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EntryForm({ entry, onClose, onSaved }: { entry: CashbookEntry | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<CashbookEntry>>({});
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const { shops, accounts } = usePaymentAccounts();

  useEffect(() => {
    if (entry) { setForm(entry); setPaymentAccountId(entry.payment_account_id || ''); }
    else setForm({ entry_date: todayISO(), type: 'income', category: 'other_income', amount: 0, notes: '', attachment: '' });
  }, [entry]);

  useEffect(() => { if (!entry && !paymentAccountId && accounts.length > 0) setPaymentAccountId(accounts[0].id); }, [accounts, entry]);

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function uploadAttachment(file: File) {
    const path = `cashbook/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(path);
      setForm((f) => ({ ...f, attachment: data.publicUrl }));
    }
  }

  async function save() {
    setSaving(true);
    const account = accounts.find((a) => a.id === paymentAccountId);
    const payload = {
      entry_date: form.entry_date, type: form.type, category: form.category,
      amount: Number(form.amount) || 0, notes: form.notes, attachment: form.attachment,
      shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
    };

    let rowId = entry?.id;
    if (entry) {
      await supabase.from('cashbook').update(payload).eq('id', entry.id);
      // Manual entries mirror 1:1 into money_transactions keyed by source_id = cashbook row id;
      // simplest correct way to handle an edit is to drop the old mirror and write a fresh one.
      await supabase.from('money_transactions').delete().eq('source_type', 'manual').eq('source_id', entry.id);
    } else {
      const { data } = await supabase.from('cashbook').insert(payload).select('*').maybeSingle();
      rowId = data?.id;
    }

    if (account && rowId && Number(payload.amount) > 0) {
      await recordTransaction({
        shop_id: account.shop_id, payment_account_id: account.id,
        direction: form.type === 'income' ? 'in' : 'out', amount: Number(payload.amount),
        source_type: 'manual', source_id: rowId,
        category: form.category || '', notes: form.notes || '', entry_date: form.entry_date,
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true} onClose={onClose} title={entry ? 'Edit Entry' : 'New Entry'}
      footer={
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type || 'income'} onChange={(e) => {
              const t = e.target.value as 'income' | 'expense';
              setForm((f) => ({ ...f, type: t, category: t === 'income' ? 'other_income' : 'miscellaneous' }));
            }}>
              <option value="income">Income (Cash In)</option>
              <option value="expense">Expense (Cash Out)</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Amount"><Input type="number" step="0.001" value={form.amount ?? 0} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} /></Field>
          <Field label="Date"><Input type="date" value={form.entry_date || ''} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} /></Field>
        </div>
        <Field label="Payment Account">
          <PaymentAccountSelect shops={shops} accounts={accounts} value={paymentAccountId} onChange={setPaymentAccountId} />
        </Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        <Field label="Attachment">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])} className="text-sm w-full file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-semibold hover:file:bg-sky-100 cursor-pointer" />
          {form.attachment && <img src={form.attachment} alt="" className="w-16 h-16 rounded-lg object-cover mt-2" />}
        </Field>
      </div>
    </Modal>
  );
}

function exportCashbook(entries: CashbookEntry[], _currency: string) {
  const rows: (string | number)[][] = [
    ['Date', 'Type', 'Category', 'Amount', 'Notes'],
    ...entries.map((e) => [fmtDate(e.entry_date), e.type, e.category.replace(/_/g, ' '), e.amount, e.notes]),
  ];
  exportCSV('cashbook.csv', rows);
}
