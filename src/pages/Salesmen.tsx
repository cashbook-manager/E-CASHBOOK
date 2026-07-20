import { useEffect, useState } from 'react';
import { Plus, UserSquare2, ChevronRight, Link as LinkIcon, DollarSign, Copy, Pencil, Trash2, Banknote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Salesman, SalesmanLedgerEntry, SalesmanAdvance, Order } from '../lib/types';
import { Card, Button, Input, Select, Field, Modal, EmptyState, Spinner, Badge, PaymentAccountSelect } from '../components/ui';
import { fmtMoney, fmtDate, todayISO } from '../lib/format';
import { useSettings, useSelectedBranch, filterByBranch } from '../lib/store';
import { navigate } from '../lib/router';
import { usePaymentAccounts } from '../lib/hooks';
import { recordTransaction } from '../lib/transactions';

export function Salesmen() {
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [advances, setAdvances] = useState<SalesmanAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Salesman | null>(null);
  const [q, setQ] = useState('');
  const { branch } = useSelectedBranch();
  const { shops } = usePaymentAccounts();

  function refresh() {
    Promise.all([
      supabase.from('salesmen').select('*').order('created_at', { ascending: false }).then((r) => r.data as Salesman[] || []),
      supabase.from('orders').select('*').then((r) => r.data as Order[] || []),
      supabase.from('salesman_advances').select('*').then((r) => r.data as SalesmanAdvance[] || []),
    ]).then(([s, o, a]) => { setSalesmen(s); setOrders(o); setAdvances(a); setLoading(false); });
  }

  useEffect(() => { refresh(); }, []);

  const filtered = filterByBranch(salesmen, branch).filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4 animate-fade">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">Salesmen</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={18} /> Add Salesman</Button>
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search salesmen…" />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<UserSquare2 />} title="No salesmen yet" subtitle="Add your first salesman" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => {
            const orderCount = orders.filter((o) => o.salesman_id === s.id).length;
            const advanceTotal = advances.filter((a) => a.salesman_id === s.id).reduce((sum, a) => sum + Number(a.amount), 0);
            return (
              <div key={s.id} className="card p-4 hover:shadow-md transition">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/salesman/${s.id}`)}>
                  {s.photo ? (
                    <img src={s.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                      {s.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{s.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge color={s.status === 'active' ? 'green' : 'slate'}>{s.status}</Badge>
                      {s.shop_id && <Badge color="blue">{shops.find((sh) => sh.id === s.shop_id)?.name || 'Branch'}</Badge>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-slate-500">{orderCount} orders</span>
                  <span className="font-bold">{fmtMoney(s.monthly_salary)}</span>
                </div>
                {advanceTotal > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Advances: {fmtMoney(advanceTotal)}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(s); setFormOpen(true); }} className="text-xs font-semibold text-sky-600 hover:text-sky-500 flex items-center gap-1"><Pencil size={13} /> Edit</button>
                  <button onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete salesman ${s.name}?`)) { await supabase.from('salesmen').delete().eq('id', s.id); refresh(); } }} className="text-xs font-semibold text-rose-500 hover:text-rose-400 flex items-center gap-1"><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && <SalesmanForm salesman={editing} shops={shops} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); refresh(); }} />}
    </div>
  );
}

function SalesmanForm({ salesman, shops, onClose, onSaved }: { salesman: Salesman | null; shops: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Salesman>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (salesman) setForm(salesman);
    else setForm({ name: '', whatsapp: '', monthly_salary: 0, commission: 0, status: 'active', photo: '', shop_id: null });
  }, [salesman]);

  async function uploadPhoto(file: File) {
    const path = `salesmen/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(path);
      setForm((f) => ({ ...f, photo: data.publicUrl }));
    }
  }

  async function save() {
    setSaving(true);
    const payload = {
      name: form.name, whatsapp: form.whatsapp, monthly_salary: Number(form.monthly_salary) || 0,
      commission: Number(form.commission) || 0, status: form.status, photo: form.photo,
      shop_id: form.shop_id || null,
    };
    if (salesman) {
      await supabase.from('salesmen').update(payload).eq('id', salesman.id);
    } else {
      await supabase.from('salesmen').insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={true} onClose={onClose} title={salesman ? 'Edit Salesman' : 'Add Salesman'}
      footer={
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name *"><Input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Salesman name" /></Field>
          <Field label="WhatsApp"><Input value={form.whatsapp || ''} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="+968..." /></Field>
          <Field label="Monthly Salary"><Input type="number" step="0.001" value={form.monthly_salary ?? 0} onChange={(e) => setForm((f) => ({ ...f, monthly_salary: Number(e.target.value) }))} /></Field>
          <Field label="Commission"><Input type="number" step="0.001" value={form.commission ?? 0} onChange={(e) => setForm((f) => ({ ...f, commission: Number(e.target.value) }))} /></Field>
          <Field label="Status">
            <Select value={form.status || 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <Field label="Branch">
            <Select value={form.shop_id || ''} onChange={(e) => setForm((f) => ({ ...f, shop_id: e.target.value || null }))}>
              <option value="">Unassigned (all branches)</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Photo">
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} className="text-sm w-full file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-semibold hover:file:bg-sky-100 cursor-pointer" />
          {form.photo && <img src={form.photo} alt="" className="w-16 h-16 rounded-full object-cover mt-2" />}
        </Field>
      </div>
    </Modal>
  );
}

export function SalesmanProfile({ id }: { id: string }) {
  const settings = useSettings();
  const currency = settings?.currency || 'OMR';
  const [salesman, setSalesman] = useState<Salesman | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<SalesmanLedgerEntry[]>([]);
  const [advances, setAdvances] = useState<SalesmanAdvance[]>([]);
  const [tab, setTab] = useState<'orders' | 'advances' | 'salary'>('orders');
  const [ledgerForm, setLedgerForm] = useState(false);
  const [advanceForm, setAdvanceForm] = useState(false);
  const [editForm, setEditForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { shops } = usePaymentAccounts();

  function refresh() {
    Promise.all([
      supabase.from('salesmen').select('*').eq('id', id).maybeSingle().then((r) => r.data as Salesman | null),
      supabase.from('orders').select('*').eq('salesman_id', id).order('created_at', { ascending: false }).then((r) => r.data as Order[] || []),
      supabase.from('salesman_salary_ledger').select('*').eq('salesman_id', id).order('created_at', { ascending: false }).then((r) => r.data as SalesmanLedgerEntry[] || []),
      supabase.from('salesman_advances').select('*').eq('salesman_id', id).order('created_at', { ascending: false }).then((r) => r.data as SalesmanAdvance[] || []),
    ]).then(([s, o, l, a]) => { setSalesman(s); setOrders(o); setLedger(l); setAdvances(a); setLoading(false); });
  }

  useEffect(() => { refresh(); }, [id]);

  const totalPaid = ledger.filter((l) => l.type !== 'advance').reduce((s, l) => s + Number(l.amount), 0);
  const advanceTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const salaryPayable = (salesman?.monthly_salary ?? 0) - advanceTotal;

  const shareUrl = `${window.location.origin}${window.location.pathname}#/share/${salesman?.share_token || ''}`;

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;
  if (!salesman) return <Card className="p-8 text-center">Salesman not found</Card>;

  return (
    <div className="space-y-4 animate-fade">
      <button onClick={() => navigate('/salesmen')} className="text-sm text-sky-600 font-semibold">← Back to Salesmen</button>

      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          {salesman.photo ? (
            <img src={salesman.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-500">
              {salesman.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{salesman.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge color={salesman.status === 'active' ? 'green' : 'slate'}>{salesman.status}</Badge>
              {salesman.whatsapp && <span className="text-sm text-slate-500">{salesman.whatsapp}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditForm(true)}><Pencil size={15} /> Edit</Button>
            <Button variant="danger" onClick={async () => { if (confirm(`Delete salesman ${salesman.name}?`)) { await supabase.from('salesmen').delete().eq('id', salesman.id); navigate('/salesmen'); } }}><Trash2 size={15} /> Delete</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 font-semibold uppercase">Monthly Salary</p>
            <p className="text-lg font-bold">{fmtMoney(salesman.monthly_salary, currency)}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs text-slate-500 font-semibold uppercase">Advance Taken</p>
            <p className="text-lg font-bold text-amber-600">{fmtMoney(advanceTotal, currency)}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-xs text-slate-500 font-semibold uppercase">Salary Payable</p>
            <p className="text-lg font-bold text-emerald-600">{fmtMoney(salaryPayable, currency)}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 font-semibold uppercase">Salary Paid</p>
            <p className="text-lg font-bold">{fmtMoney(totalPaid, currency)}</p>
          </div>
        </div>

        {salesman.commission > 0 && (
          <p className="text-sm text-slate-500 mt-2">Commission: {fmtMoney(salesman.commission, currency)}</p>
        )}

        {/* Share link */}
        <div className="mt-4 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon size={15} className="text-sky-600" />
            <p className="text-xs font-semibold text-sky-700 dark:text-sky-400">Read-only Share Link</p>
          </div>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="text-xs bg-white dark:bg-slate-950" />
            <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link copied!'); }}>
              <Copy size={16} /> Copy
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {(['orders', 'advances', 'salary'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition whitespace-nowrap ${
              tab === t ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500'
            }`}>
            {t === 'salary' ? 'Salary Payments' : t === 'advances' ? 'Salary Advances' : t}
          </button>
        ))}
      </div>

      {tab === 'orders' ? (
        <div className="space-y-2">
          {orders.length === 0 ? <Card><EmptyState icon={<UserSquare2 />} title="No orders assigned" /></Card> : (
            orders.map((o) => (
              <Card key={o.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{o.customer_name} <span className="text-slate-400">#{o.receipt_number}</span></p>
                  <p className="text-xs text-slate-500">Due {fmtDate(o.delivery_date)} · {fmtMoney(o.balance, currency)}</p>
                </div>
                <Badge color={o.status === 'delivered' ? 'slate' : o.status === 'ready' ? 'green' : o.status === 'stitching' ? 'blue' : o.status === 'cutting' ? 'amber' : 'rose'}>
                  {o.status}
                </Badge>
              </Card>
            ))
          )}
        </div>
      ) : tab === 'advances' ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">Salary Advances</h3>
            <Button onClick={() => setAdvanceForm(true)}><Banknote size={16} /> Give Advance</Button>
          </div>
          {advances.length === 0 ? <Card><EmptyState icon={<Banknote />} title="No advances yet" /></Card> : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left p-3">Date</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Remarks</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {advances.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{fmtDate(a.advance_date)}</td>
                      <td className="p-3 text-right font-bold text-amber-600">{fmtMoney(a.amount, currency)}</td>
                      <td className="p-3">{a.remarks || '—'}</td>
                      <td className="p-3"><button onClick={async () => { if (confirm('Delete this advance? This will also remove the cashbook entry.')) { await supabase.from('salesman_advances').delete().eq('id', a.id); await supabase.from('cashbook').delete().eq('id', a.id).eq('category', 'salesman_advance').eq('type', 'expense'); refresh(); } }} className="text-rose-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {advanceForm && <SalesmanAdvanceForm salesmanId={id} salesmanName={salesman.name} onClose={() => setAdvanceForm(false)} onSaved={() => { setAdvanceForm(false); refresh(); }} />}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">Salary Payments</h3>
            <Button onClick={() => setLedgerForm(true)}><Plus size={16} /> Record Payment</Button>
          </div>
          {ledger.length === 0 ? <Card><EmptyState icon={<DollarSign />} title="No salary records yet" /></Card> : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left p-3">Date</th><th className="text-right p-3">Amount</th><th className="text-left p-3">Remarks</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{fmtDate(l.payment_date)}</td>
                      <td className="p-3 text-right font-bold">{fmtMoney(l.amount, currency)}</td>
                      <td className="p-3">{l.remarks || '—'}</td>
                      <td className="p-3"><button onClick={async () => { if (confirm('Delete this salary record? This will also remove the cashbook entry.')) { await supabase.from('salesman_salary_ledger').delete().eq('id', l.id); await supabase.from('cashbook').delete().eq('id', l.id).eq('category', 'salesman_salary').eq('type', 'expense'); refresh(); } }} className="text-rose-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {ledgerForm && <LedgerForm salesmanId={id} salesmanName={salesman.name} onClose={() => setLedgerForm(false)} onSaved={() => { setLedgerForm(false); refresh(); }} />}
        </div>
      )}

      {editForm && <SalesmanForm salesman={salesman} shops={shops} onClose={() => setEditForm(false)} onSaved={() => { setEditForm(false); refresh(); }} />}
    </div>
  );
}

function LedgerForm({ salesmanId, salesmanName, onClose, onSaved }: { salesmanId: string; salesmanName: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<SalesmanLedgerEntry>>({ amount: 0, payment_date: todayISO(), remarks: '' });
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const { shops, accounts } = usePaymentAccounts();

  useEffect(() => { if (!paymentAccountId && accounts.length > 0) setPaymentAccountId(accounts[0].id); }, [accounts]);

  async function save() {
    setSaving(true);
    const account = accounts.find((a) => a.id === paymentAccountId);
    const { data } = await supabase.from('salesman_salary_ledger').insert({
      salesman_id: salesmanId,
      amount: Number(form.amount) || 0,
      payment_date: form.payment_date,
      remarks: form.remarks,
      type: 'payment',
      shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
    }).select('*').maybeSingle();

    // Create matching cashbook entry (cash-out)
    if (data) {
      await supabase.from('cashbook').insert({
        id: data.id, entry_date: form.payment_date, type: 'expense',
        category: 'salesman_salary', amount: Number(form.amount) || 0,
        notes: `Salary payment: ${salesmanName}`,
        shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
      });
      if (account) {
        await recordTransaction({
          shop_id: account.shop_id, payment_account_id: account.id,
          direction: 'out', amount: Number(form.amount) || 0,
          source_type: 'salary', source_id: data.id,
          category: 'salesman_salary', notes: `Salary payment: ${salesmanName}`, entry_date: form.payment_date,
        });
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true} onClose={onClose} title="Record Salary Payment"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Amount"><Input type="number" step="0.001" value={form.amount ?? 0} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} /></Field>
        <Field label="Date"><Input type="date" value={form.payment_date || ''} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} /></Field>
        <Field label="Paid From">
          <PaymentAccountSelect shops={shops} accounts={accounts} value={paymentAccountId} onChange={setPaymentAccountId} />
        </Field>
        <Field label="Remarks"><Input value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
        <p className="text-xs text-slate-500">This will automatically create a cash-out entry in the Cashbook.</p>
      </div>
    </Modal>
  );
}

function SalesmanAdvanceForm({ salesmanId, salesmanName, onClose, onSaved }: { salesmanId: string; salesmanName: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<SalesmanAdvance>>({ amount: 0, advance_date: todayISO(), remarks: '' });
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const { shops, accounts } = usePaymentAccounts();

  useEffect(() => { if (!paymentAccountId && accounts.length > 0) setPaymentAccountId(accounts[0].id); }, [accounts]);

  async function save() {
    setSaving(true);
    const account = accounts.find((a) => a.id === paymentAccountId);
    const { data } = await supabase.from('salesman_advances').insert({
      salesman_id: salesmanId,
      amount: Number(form.amount) || 0,
      advance_date: form.advance_date,
      remarks: form.remarks,
      shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
    }).select('*').maybeSingle();

    // Create matching cashbook entry (cash-out)
    if (data) {
      await supabase.from('cashbook').insert({
        id: data.id, entry_date: form.advance_date, type: 'expense',
        category: 'salesman_advance', amount: Number(form.amount) || 0,
        notes: `Advance to ${salesmanName}`,
        shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
      });
      if (account) {
        await recordTransaction({
          shop_id: account.shop_id, payment_account_id: account.id,
          direction: 'out', amount: Number(form.amount) || 0,
          source_type: 'advance', source_id: data.id,
          category: 'salesman_advance', notes: `Advance to ${salesmanName}`, entry_date: form.advance_date,
        });
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true} onClose={onClose} title="Salary Advance"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Amount"><Input type="number" step="0.001" value={form.amount ?? 0} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} /></Field>
        <Field label="Date"><Input type="date" value={form.advance_date || ''} onChange={(e) => setForm((f) => ({ ...f, advance_date: e.target.value }))} /></Field>
        <Field label="Paid From">
          <PaymentAccountSelect shops={shops} accounts={accounts} value={paymentAccountId} onChange={setPaymentAccountId} />
        </Field>
        <Field label="Remarks"><Input value={form.remarks || ''} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
        <p className="text-xs text-slate-500">This will automatically create a cash-out entry in the Cashbook.</p>
      </div>
    </Modal>
  );
}


