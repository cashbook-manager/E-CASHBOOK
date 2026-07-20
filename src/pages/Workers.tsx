import { useEffect, useState } from 'react';
import { Plus, Users, ChevronRight, FileSpreadsheet, DollarSign, Pencil, Trash2, Banknote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Worker, WorkerCategory, WorkerDesign, WorkerPayment, WorkerFinalPayment, WorkerAdvance, OrderWorker, Order } from '../lib/types';
import { Card, Button, Input, Select, Field, Modal, EmptyState, Spinner, Badge, PaymentAccountSelect } from '../components/ui';
import { fmtMoney, fmtDate, todayISO } from '../lib/format';
import { useSettings, useSelectedBranch, filterByBranch } from '../lib/store';
import { navigate } from '../lib/router';
import { usePaymentAccounts } from '../lib/hooks';
import { recordTransaction } from '../lib/transactions';

const CATEGORIES: { value: WorkerCategory; label: string }[] = [
  { value: 'cutting', label: 'Cutting' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'rhinestone', label: 'Rhinestone' },
  { value: 'stitching', label: 'Stitching' },
];

export function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [q, setQ] = useState('');
  const [advances, setAdvances] = useState<WorkerAdvance[]>([]);
  const [payments, setPayments] = useState<WorkerPayment[]>([]);
  const { branch } = useSelectedBranch();
  const { shops } = usePaymentAccounts();

  function refresh() {
    Promise.all([
      supabase.from('workers').select('*').order('created_at', { ascending: false }).then((r) => r.data as Worker[] || []),
      supabase.from('worker_advances').select('*').then((r) => r.data as WorkerAdvance[] || []),
      supabase.from('worker_payments').select('*').then((r) => r.data as WorkerPayment[] || []),
    ]).then(([w, a, p]) => {
      setWorkers(w); setAdvances(a); setPayments(p); setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, []);

  const filtered = filterByBranch(workers, branch).filter((w) =>
    w.name.toLowerCase().includes(q.toLowerCase()) || w.category.includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">Workers</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={18} /> Add Worker</Button>
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search workers…" />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Users />} title="No workers yet" subtitle="Add your first worker to get started" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((w) => {
            const advanceTotal = advances.filter((a) => a.worker_id === w.id).reduce((s, a) => s + Number(a.amount), 0);
            const earned = payments.filter((p) => p.worker_id === w.id).reduce((s, p) => s + Number(p.amount), 0);
            const netPayable = earned - advanceTotal;
            return (
              <div key={w.id} className="card p-4 hover:shadow-md transition">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/worker/${w.id}`)}>
                  {w.photo ? (
                    <img src={w.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold">
                      {w.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{w.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge color="sky">{w.category}</Badge>
                      {w.shop_id && <Badge color="blue">{shops.find((sh) => sh.id === w.shop_id)?.name || 'Branch'}</Badge>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
                <div className="grid grid-cols-3 gap-1 mt-3 text-center">
                  <div><p className="text-xs text-slate-400">Earned</p><p className="text-sm font-bold text-emerald-600">{fmtMoney(earned)}</p></div>
                  <div><p className="text-xs text-slate-400">Advances</p><p className="text-sm font-bold text-amber-600">{fmtMoney(advanceTotal)}</p></div>
                  <div><p className="text-xs text-slate-400">Net Payable</p><p className="text-sm font-bold">{fmtMoney(netPayable)}</p></div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(w); setFormOpen(true); }} className="text-xs font-semibold text-sky-600 hover:text-sky-500 flex items-center gap-1"><Pencil size={13} /> Edit</button>
                  <button onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete worker ${w.name}?`)) { await supabase.from('workers').delete().eq('id', w.id); refresh(); } }} className="text-xs font-semibold text-rose-500 hover:text-rose-400 flex items-center gap-1"><Trash2 size={13} /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && <WorkerForm open={formOpen} worker={editing} shops={shops} onClose={() => setFormOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function WorkerForm({ open, worker, shops, onClose, onSaved }: { open: boolean; worker: Worker | null; shops: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Worker>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (worker) setForm(worker);
    else setForm({ name: '', whatsapp: '', category: 'cutting', join_date: todayISO(), status: 'active', photo: '', monthly_salary: 0, shop_id: null });
  }, [worker, open]);

  async function uploadPhoto(file: File) {
    const path = `workers/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(path);
      setForm((f) => ({ ...f, photo: data.publicUrl }));
    }
  }

  async function save() {
    setSaving(true);
    const payload = {
      name: form.name, whatsapp: form.whatsapp, category: form.category, join_date: form.join_date,
      status: form.status, photo: form.photo, monthly_salary: Number(form.monthly_salary) || 0,
      shop_id: form.shop_id || null,
    };
    if (worker) await supabase.from('workers').update(payload).eq('id', worker.id);
    else await supabase.from('workers').insert(payload);
    setSaving(false); onSaved(); onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose} title={worker ? 'Edit Worker' : 'Add Worker'}
      footer={
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name *"><Input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Worker name" /></Field>
          <Field label="WhatsApp"><Input value={form.whatsapp || ''} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="+968..." /></Field>
          <Field label="Category">
            <Select value={form.category || 'cutting'} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as WorkerCategory }))}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Join Date"><Input type="date" value={form.join_date || ''} onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))} /></Field>
          <Field label="Status">
            <Select value={form.status || 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option><option value="inactive">Inactive</option>
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

export function WorkerProfile({ id }: { id: string }) {
  const settings = useSettings();
  const currency = settings?.currency || 'OMR';
  const [worker, setWorker] = useState<Worker | null>(null);
  const [designs, setDesigns] = useState<WorkerDesign[]>([]);
  const [payments, setPayments] = useState<WorkerPayment[]>([]);
  const [finalPayments, setFinalPayments] = useState<WorkerFinalPayment[]>([]);
  const [advances, setAdvances] = useState<WorkerAdvance[]>([]);
  const [assignments, setAssignments] = useState<OrderWorker[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'overview' | 'advances' | 'settlement' | 'designs'>('overview');
  const { shops } = usePaymentAccounts();
  const [designForm, setDesignForm] = useState(false);
  const [advanceForm, setAdvanceForm] = useState(false);
  const [settlementForm, setSettlementForm] = useState(false);
  const [editForm, setEditForm] = useState(false);
  const [loading, setLoading] = useState(true);

  function refresh() {
    Promise.all([
      supabase.from('workers').select('*').eq('id', id).maybeSingle().then((r) => r.data as Worker | null),
      supabase.from('worker_designs').select('*').eq('worker_id', id).order('created_at', { ascending: false }).then((r) => r.data as WorkerDesign[] || []),
      supabase.from('worker_payments').select('*').eq('worker_id', id).order('created_at', { ascending: false }).then((r) => r.data as WorkerPayment[] || []),
      supabase.from('worker_final_payments').select('*').eq('worker_id', id).order('created_at', { ascending: false }).then((r) => r.data as WorkerFinalPayment[] || []),
      supabase.from('worker_advances').select('*').eq('worker_id', id).order('created_at', { ascending: false }).then((r) => r.data as WorkerAdvance[] || []),
      supabase.from('order_workers').select('*').eq('worker_id', id).then((r) => r.data as OrderWorker[] || []),
    ]).then(([w, d, p, fp, adv, a]) => {
      setWorker(w); setDesigns(d); setPayments(p); setFinalPayments(fp); setAdvances(adv); setAssignments(a);
      if (a.length > 0) {
        const ids = a.map((x) => x.order_id);
        supabase.from('orders').select('*').in('id', ids).then(({ data }) => setOrders((data as Order[]) || []));
      }
      setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, [id]);

  const totalEarned = payments.reduce((s, p) => s + Number(p.amount), 0);
  const advanceTotal = advances.reduce((s, a) => s + Number(a.amount), 0);
  const totalPaid = finalPayments.reduce((s, p) => s + Number(p.final_amount), 0);
  const netPayable = totalEarned - advanceTotal - totalPaid;

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;
  if (!worker) return <Card className="p-8 text-center">Worker not found</Card>;

  return (
    <div className="space-y-4 animate-fade">
      <button onClick={() => navigate('/workers')} className="text-sm text-sky-600 font-semibold">← Back to Workers</button>

      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          {worker.photo ? (
            <img src={worker.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-slate-500">{worker.name.charAt(0)}</div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{worker.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge color="sky">{worker.category}</Badge>
              <Badge color={worker.status === 'active' ? 'green' : 'slate'}>{worker.status}</Badge>
              {worker.whatsapp && <span className="text-sm text-slate-500">{worker.whatsapp}</span>}
            </div>
            <p className="text-xs text-slate-400 mt-1">Joined {fmtDate(worker.join_date)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditForm(true)}><Pencil size={15} /> Edit</Button>
            <Button variant="danger" onClick={async () => { if (confirm(`Delete worker ${worker.name}?`)) { await supabase.from('workers').delete().eq('id', worker.id); navigate('/workers'); } }}><Trash2 size={15} /> Delete</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="text-center p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Earned</p>
            <p className="text-lg font-bold text-emerald-600">{fmtMoney(totalEarned, currency)}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs text-slate-500 font-semibold uppercase">Advances Taken</p>
            <p className="text-lg font-bold text-amber-600">{fmtMoney(advanceTotal, currency)}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Paid</p>
            <p className="text-lg font-bold">{fmtMoney(totalPaid, currency)}</p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-sky-50 dark:bg-sky-900/20">
            <p className="text-xs text-slate-500 font-semibold uppercase">Net Payable</p>
            <p className="text-lg font-bold text-sky-600">{fmtMoney(netPayable, currency)}</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {(['overview', 'advances', 'settlement', 'designs'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition whitespace-nowrap ${
              tab === t ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500'
            }`}>
            {t === 'settlement' ? 'Settlements' : t === 'advances' ? 'Advances' : t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-3">
          <Card className="p-4">
            <h3 className="font-bold mb-2">Order Assignments</h3>
            {assignments.length === 0 ? <p className="text-sm text-slate-500">No assignments yet</p> : (
              <div className="space-y-1">
                {assignments.map((a) => {
                  const o = orders.find((x) => x.id === a.order_id);
                  const lineTotal = (Number(a.quantity) || 0) * (Number(a.rate) || 0);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                      <div>
                        <span className="font-semibold">#{o?.receipt_number || '—'}</span>
                        <span className="text-slate-500 ml-2">{a.category}{a.design_number ? ` · #${a.design_number}` : ''} · Qty {a.quantity}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{fmtMoney(lineTotal, currency)}</span>
                        <span className={a.submitted ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>
                          {a.submitted ? 'Submitted' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          {payments.length > 0 && (
            <Card className="p-4">
              <h3 className="font-bold mb-2">Earnings History (Completed Work)</h3>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm">
                    <div>
                      <span className="font-semibold">#{p.receipt_number || '—'}</span>
                      {p.design_number && <span className="text-slate-500 ml-2">Design #{p.design_number}</span>}
                      <span className="text-slate-400 ml-2">{fmtDate(p.submission_date)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">{p.quantity} × {fmtMoney(Number(p.price) || 0, currency)}</span>
                      <span className="font-bold ml-2 text-emerald-600">{fmtMoney(p.amount, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'advances' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">Salary Advances</h3>
            <Button onClick={() => setAdvanceForm(true)}><Banknote size={16} /> Give Advance</Button>
          </div>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Total Advances</p><p className="text-lg font-bold text-amber-600">{fmtMoney(advanceTotal, currency)}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Total Earned</p><p className="text-lg font-bold text-emerald-600">{fmtMoney(totalEarned, currency)}</p></div>
            </div>
          </Card>
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
                      <td className="p-3"><button onClick={async () => {
                        if (confirm('Delete this advance? This will also remove the cashbook entry.')) {
                          await supabase.from('worker_advances').delete().eq('id', a.id);
                          await supabase.from('cashbook').delete().eq('id', a.id).eq('category', 'worker_advance').eq('type', 'expense');
                          refresh();
                        }
                      }} className="text-rose-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {advanceForm && <AdvanceForm workerId={id} workerName={worker.name} onClose={() => setAdvanceForm(false)} onSaved={() => { setAdvanceForm(false); refresh(); }} />}
        </div>
      )}

      {tab === 'settlement' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">Settlements (Final Payments)</h3>
            <Button onClick={() => setSettlementForm(true)}><DollarSign size={16} /> New Settlement</Button>
          </div>
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Total Earned</p><p className="text-lg font-bold text-emerald-600">{fmtMoney(totalEarned, currency)}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Advances</p><p className="text-lg font-bold text-amber-600">{fmtMoney(advanceTotal, currency)}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Already Paid</p><p className="text-lg font-bold">{fmtMoney(totalPaid, currency)}</p></div>
              <div><p className="text-xs text-slate-500 uppercase font-semibold">Net Payable</p><p className="text-lg font-bold text-sky-600">{fmtMoney(netPayable, currency)}</p></div>
            </div>
          </Card>
          {finalPayments.length === 0 ? <Card><EmptyState icon={<DollarSign />} title="No settlements yet" /></Card> : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left p-3">Date</th><th className="text-right p-3">Earned</th><th className="text-right p-3">Discount</th><th className="text-right p-3">Final</th><th className="text-left p-3">Method</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {finalPayments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{fmtDate(p.payment_date)}</td>
                      <td className="p-3 text-right">{fmtMoney(p.total_earned, currency)}</td>
                      <td className="p-3 text-right">{fmtMoney(p.discount, currency)}</td>
                      <td className="p-3 text-right font-bold">{fmtMoney(p.final_amount, currency)}</td>
                      <td className="p-3">{p.payment_method}</td>
                      <td className="p-3"><button onClick={async () => {
                        if (confirm('Delete this settlement? This will also remove the cashbook entry.')) {
                          await supabase.from('worker_final_payments').delete().eq('id', p.id);
                          await supabase.from('cashbook').delete().eq('id', p.id).eq('category', 'worker_salary').eq('type', 'expense');
                          refresh();
                        }
                      }} className="text-rose-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {settlementForm && <SettlementForm workerId={id} workerName={worker.name} totalEarned={totalEarned} advanceTotal={advanceTotal} netPayable={netPayable} onClose={() => setSettlementForm(false)} onSaved={() => { setSettlementForm(false); refresh(); }} />}
        </div>
      )}

      {tab === 'designs' && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <h3 className="font-bold">Design Numbers & Rates</h3>
            <Button onClick={() => setDesignForm(true)}><Plus size={16} /> Add Design</Button>
          </div>
          {designs.length === 0 ? <Card><EmptyState icon={<FileSpreadsheet />} title="No designs yet" subtitle="Add designs with rates for piece-rate payment" /></Card> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {designs.map((d) => (
                <Card key={d.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">#{d.design_number}</p>
                      <p className="text-xs text-slate-500">{d.design_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{fmtMoney(d.price, currency)}</span>
                      <button onClick={async () => { if (confirm('Delete this design?')) { await supabase.from('worker_designs').delete().eq('id', d.id); refresh(); } }} className="text-rose-500 hover:text-rose-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {d.description && <p className="text-xs text-slate-400 mt-1">{d.description}</p>}
                </Card>
              ))}
            </div>
          )}
          {designForm && <DesignForm workerId={id} onClose={() => setDesignForm(false)} onSaved={() => { setDesignForm(false); refresh(); }} />}
        </div>
      )}

      {editForm && <WorkerForm open={editForm} worker={worker} shops={shops} onClose={() => setEditForm(false)} onSaved={() => { setEditForm(false); refresh(); }} />}
    </div>
  );
}

function DesignForm({ workerId, onClose, onSaved }: { workerId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<WorkerDesign>>({ design_number: '', design_name: '', price: 0, description: '' });

  async function save() {
    await supabase.from('worker_designs').insert({
      worker_id: workerId, design_number: form.design_number, design_name: form.design_name,
      price: Number(form.price) || 0, description: form.description,
    });
    onSaved();
  }

  return (
    <Modal
      open={true} onClose={onClose} title="Add Design Number"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!form.design_number}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Design Number *"><Input value={form.design_number || ''} onChange={(e) => setForm((f) => ({ ...f, design_number: e.target.value }))} /></Field>
        <Field label="Design Name"><Input value={form.design_name || ''} onChange={(e) => setForm((f) => ({ ...f, design_name: e.target.value }))} /></Field>
        <Field label="Rate (Price)"><Input type="number" step="0.001" value={form.price ?? 0} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} /></Field>
        <Field label="Description"><Input value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      </div>
    </Modal>
  );
}

function AdvanceForm({ workerId, workerName, onClose, onSaved }: { workerId: string; workerName: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<WorkerAdvance>>({ amount: 0, advance_date: todayISO(), remarks: '' });
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const { shops, accounts } = usePaymentAccounts();

  useEffect(() => { if (!paymentAccountId && accounts.length > 0) setPaymentAccountId(accounts[0].id); }, [accounts]);

  async function save() {
    setSaving(true);
    const account = accounts.find((a) => a.id === paymentAccountId);
    const { data } = await supabase.from('worker_advances').insert({
      worker_id: workerId, amount: Number(form.amount) || 0,
      advance_date: form.advance_date, remarks: form.remarks,
      shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
    }).select('*').maybeSingle();

    // Create matching cashbook entry (cash-out)
    if (data) {
      await supabase.from('cashbook').insert({
        id: data.id, entry_date: form.advance_date, type: 'expense',
        category: 'worker_advance', amount: Number(form.amount) || 0,
        notes: `Advance to ${workerName}`,
        shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
      });
      if (account) {
        await recordTransaction({
          shop_id: account.shop_id, payment_account_id: account.id,
          direction: 'out', amount: Number(form.amount) || 0,
          source_type: 'advance', source_id: data.id,
          category: 'worker_advance', notes: `Advance to ${workerName}`, entry_date: form.advance_date,
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

function SettlementForm({ workerId, workerName, totalEarned, advanceTotal, netPayable, onClose, onSaved }: {
  workerId: string; workerName: string; totalEarned: number; advanceTotal: number; netPayable: number;
  onClose: () => void; onSaved: () => void;
}) {
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [remarks, setRemarks] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const { shops, accounts } = usePaymentAccounts();

  useEffect(() => { if (!paymentAccountId && accounts.length > 0) setPaymentAccountId(accounts[0].id); }, [accounts]);

  const finalAmount = netPayable - discount;

  async function save() {
    setSaving(true);
    const account = accounts.find((a) => a.id === paymentAccountId);
    const { data } = await supabase.from('worker_final_payments').insert({
      worker_id: workerId,
      total_earned: totalEarned,
      discount: Number(discount) || 0,
      final_amount: finalAmount,
      payment_method: paymentMethod,
      remarks, payment_date: paymentDate,
      shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
    }).select('*').maybeSingle();

    // Create matching cashbook entry (cash-out)
    if (data) {
      await supabase.from('cashbook').insert({
        id: data.id, entry_date: paymentDate, type: 'expense',
        category: 'worker_salary', amount: finalAmount,
        notes: `Salary settlement: ${workerName}`,
        shop_id: account?.shop_id || null, payment_account_id: account?.id || null,
      });
      if (account) {
        await recordTransaction({
          shop_id: account.shop_id, payment_account_id: account.id,
          direction: 'out', amount: finalAmount,
          source_type: 'salary', source_id: data.id,
          category: 'worker_salary', notes: `Salary settlement: ${workerName}`, entry_date: paymentDate,
        });
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open={true} onClose={onClose} title="New Settlement"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || finalAmount <= 0}>{saving ? 'Saving…' : 'Pay Salary'}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div><p className="text-xs text-slate-500 font-semibold">Total Earned</p><p className="font-bold text-emerald-600">{fmtMoney(totalEarned)}</p></div>
          <div><p className="text-xs text-slate-500 font-semibold">Advances Taken</p><p className="font-bold text-amber-600">{fmtMoney(advanceTotal)}</p></div>
        </div>
        <Field label="Discount / Deduction"><Input type="number" step="0.001" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
        <Field label="Net Payable (auto)"><Input value={finalAmount.toFixed(3)} disabled className="bg-slate-50 dark:bg-slate-900" /></Field>
        <Field label="Payment Method">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Paid From">
          <PaymentAccountSelect shops={shops} accounts={accounts} value={paymentAccountId} onChange={setPaymentAccountId} />
        </Field>
        <Field label="Payment Date"><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></Field>
        <Field label="Remarks"><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">Net Payable = Total Earned - Advances - Discount. This will create a cash-out entry in the Cashbook.</p>
      </div>
    </Modal>
  );
}
