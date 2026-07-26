import { useEffect, useState } from 'react';
import { supabase, RECEIPTS_BUCKET } from '../lib/supabase';
import type { Order, Salesman, Worker, WorkerCategory, WorkerDesign, OrderWorker, SaleType, OrderStatus } from '../lib/types';
import { Modal, Field, Input, Textarea, Select, Button, Label, PaymentAccountSelect } from './ui';
import { todayISO, fmtMoney } from '../lib/format';
import { usePaymentAccounts } from '../lib/hooks';
import { recordTransaction } from '../lib/transactions';

const CATEGORIES: { value: WorkerCategory; label: string }[] = [
  { value: 'cutting', label: 'Cutting' },
  { value: 'embroidery', label: 'Embroidery' },
  { value: 'rhinestone', label: 'Rhinestone' },
  { value: 'stitching', label: 'Stitching' },
];

const SALE_TYPES: { value: SaleType; label: string }[] = [
  { value: 'tailoring', label: 'Tailoring Order' },
  { value: 'readymade', label: 'Readymade Clothes' },
  { value: 'fabric', label: 'Fabric Sale' },
];

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'stitching', label: 'Stitching' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
];

interface AssignmentDraft {
  worker_id: string;
  category: WorkerCategory;
  design_number: string;
  quantity: number;
  rate: number;
}

export function OrderForm({
  open, onClose, onSaved, order, salesmen, workers, autoScanFile, queuePosition, queueTotal,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  order: Order | null;
  salesmen: Salesman[];
  workers: Worker[];
  /** When set (from the header's Quick Capture flow), this photo is scanned automatically on open. */
  autoScanFile?: File | null;
  queuePosition?: number;
  queueTotal?: number;
}) {
  const [form, setForm] = useState<Partial<Order>>({});
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);
  const [designs, setDesigns] = useState<WorkerDesign[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ confidence: string; uncertain: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const { shops, accounts } = usePaymentAccounts();

  // Quick Capture hand-off: a photo arrived from the header camera — scan it right away.
  useEffect(() => {
    if (autoScanFile) scanReceipt(autoScanFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScanFile]);

  useEffect(() => {
    supabase.from('worker_designs').select('*').then(({ data }) => {
      if (data) setDesigns(data as WorkerDesign[]);
    });
  }, []);

  useEffect(() => {
    if (order) {
      setForm(order);
      supabase
        .from('order_workers')
        .select('*')
        .eq('order_id', order.id)
        .then(({ data }) => {
          if (data) setAssignments((data as OrderWorker[]).map((a) => ({
            worker_id: a.worker_id, category: a.category,
            design_number: a.design_number || '', quantity: a.quantity || 1, rate: Number(a.rate) || 0,
          })));
        });
    } else {
      setForm({
        receipt_number: '', customer_name: '', whatsapp_number: '', order_type: '',
        order_date: todayISO(), delivery_date: '', total_amount: 0, advance: 0,
        additional_payment: 0, measurement: '', notes: '', remarks: '',
        priority: 'normal', status: 'pending', sale_type: 'tailoring',
        payment_account_id: null,
      });
      setAssignments([]);
    }
  }, [order, open]);

  // Default to the first available payment account once accounts have loaded (new orders only)
  useEffect(() => {
    if (!order && open && !form.payment_account_id && accounts.length > 0) {
      setForm((f) => ({ ...f, payment_account_id: accounts[0].id }));
    }
  }, [accounts, order, open]);

  const set = (k: keyof Order, v: any) => setForm((f) => ({ ...f, [k]: v }));

  function updateAssignment(i: number, patch: Partial<AssignmentDraft>) {
    setAssignments((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function onWorkerSelected(i: number, workerId: string) {
    const w = workers.find((x) => x.id === workerId);
    const patch: Partial<AssignmentDraft> = { worker_id: workerId };
    if (w) patch.category = w.category;
    updateAssignment(i, patch);
  }

  function onDesignSelected(i: number, designNumber: string) {
    const a = assignments[i];
    const d = designs.find((x) => x.design_number === designNumber && x.worker_id === a.worker_id);
    if (d) updateAssignment(i, { design_number: designNumber, rate: Number(d.price) });
    else updateAssignment(i, { design_number: designNumber });
  }

  async function uploadReceipt(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `receipts/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(path);
      set('receipt_image', data.publicUrl);
    }
    setUploading(false);
  }

  async function scanReceipt(file: File) {
    setScanning(true);
    setScanResult(null);
    try {
      // Also save the photo itself as the receipt image, same as manual upload.
      await uploadReceipt(file);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read image file'));
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { image_base64: base64, media_type: file.type || 'image/jpeg' },
      });

      if (error || data?.error) {
        alert(`Could not scan receipt: ${data?.error || error?.message || 'unknown error'}`);
        return;
      }

      const f = data.fields || {};
      setForm((prev) => ({
        ...prev,
        receipt_number: f.receipt_number || prev.receipt_number,
        customer_name: f.customer_name || prev.customer_name,
        whatsapp_number: f.whatsapp_number || prev.whatsapp_number,
        order_type: f.order_type || prev.order_type,
        order_date: f.order_date || prev.order_date,
        delivery_date: f.delivery_date || prev.delivery_date,
        total_amount: f.total_amount ?? prev.total_amount,
        advance: f.advance ?? prev.advance,
        measurement: f.measurement || prev.measurement,
        notes: f.notes || prev.notes,
      }));
      setScanResult({ confidence: f.confidence || 'medium', uncertain: f.uncertain_fields || [] });
    } finally {
      setScanning(false);
    }
  }

  async function save() {
    setSaving(true);
    const selectedAccount = accounts.find((a) => a.id === form.payment_account_id);
    const payload: any = {
      receipt_number: form.receipt_number, customer_name: form.customer_name,
      whatsapp_number: form.whatsapp_number || '', order_type: form.order_type || '',
      order_date: form.order_date || todayISO(), delivery_date: form.delivery_date || null,
      total_amount: Number(form.total_amount) || 0, advance: Number(form.advance) || 0,
      additional_payment: Number(form.additional_payment) || 0,
      measurement: form.measurement || '', notes: form.notes || '', remarks: form.remarks || '',
      receipt_image: form.receipt_image || '', salesman_id: form.salesman_id || null,
      priority: form.priority || 'normal', status: form.status || 'pending',
      sale_type: form.sale_type || 'tailoring', updated_at: new Date().toISOString(),
      payment_account_id: form.payment_account_id || null,
      shop_id: selectedAccount?.shop_id || null,
    };

    const owPayload = assignments
      .filter((a) => a.worker_id) // drop rows where no worker was picked from the dropdown
      .map((a) => ({
        worker_id: a.worker_id, category: a.category, design_number: a.design_number || '',
        quantity: Number(a.quantity) || 1, rate: Number(a.rate) || 0, submitted: false,
      }));

    // Money in from this order = advance + additional_payment (readymade/fabric sales
    // are entered entirely as `total_amount` with `advance` covering the full sale).
    const newMoneyIn = (Number(form.advance) || 0) + (Number(form.additional_payment) || 0);
    const prevMoneyIn = order ? Number(order.advance) + Number(order.additional_payment || 0) : 0;
    const delta = newMoneyIn - prevMoneyIn;

    if (order) {
      const { error: orderErr } = await supabase.from('orders').update(payload).eq('id', order.id);
      if (orderErr) {
        alert(`Could not save order: ${orderErr.message}`);
        setSaving(false);
        return;
      }
      const { error: delErr } = await supabase.from('order_workers').delete().eq('order_id', order.id);
      if (delErr) console.error('Failed to clear old worker assignments:', delErr.message);
      await supabase.from('order_timeline').insert({
        order_id: order.id, action: 'Order Updated', detail: 'Order details updated', person: 'Admin',
      });
      const workerErrors: string[] = [];
      for (const a of owPayload) {
        const { error } = await supabase.from('order_workers').insert({ ...a, order_id: order.id });
        if (error) {
          console.error('Failed to save worker assignment:', error.message);
          workerErrors.push(error.message);
        }
      }
      if (workerErrors.length > 0) {
        alert(`Order saved, but ${workerErrors.length} worker assignment(s) failed to save:\n${workerErrors.join('\n')}`);
      }
      if (selectedAccount && Math.abs(delta) > 0.0001) {
        await recordTransaction({
          shop_id: selectedAccount.shop_id, payment_account_id: selectedAccount.id,
          direction: delta > 0 ? 'in' : 'out', amount: Math.abs(delta),
          source_type: 'order', source_id: order.id,
          category: form.sale_type === 'tailoring' ? 'order_payment' : `${form.sale_type}_sale`,
          notes: `${order.receipt_number} · ${order.customer_name}`,
        });
      }
    } else {
      const { data, error: insertErr } = await supabase.from('orders').insert(payload).select('*').maybeSingle();
      if (insertErr) {
        alert(`Could not create order: ${insertErr.message}`);
        setSaving(false);
        return;
      }
      if (data) {
        const newOrder = data as Order;
        await supabase.from('order_timeline').insert({
          order_id: newOrder.id, action: 'Order Created', detail: `Receipt #${newOrder.receipt_number}`, person: 'Admin',
        });
        for (const a of owPayload) {
          const { error } = await supabase.from('order_workers').insert({ ...a, order_id: newOrder.id });
          if (error) console.error('Failed to save worker assignment:', error.message);
          const w = workers.find((x) => x.id === a.worker_id);
          await supabase.from('order_timeline').insert({
            order_id: newOrder.id, action: 'Worker Assigned', detail: `${a.category}: ${w?.name || ''}`, person: 'Admin',
          });
        }
        if (selectedAccount && newMoneyIn > 0.0001) {
          await recordTransaction({
            shop_id: selectedAccount.shop_id, payment_account_id: selectedAccount.id,
            direction: 'in', amount: newMoneyIn,
            source_type: 'order', source_id: newOrder.id,
            category: form.sale_type === 'tailoring' ? 'order_payment' : `${form.sale_type}_sale`,
            notes: `${newOrder.receipt_number} · ${newOrder.customer_name}`,
          });
        }
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  const balance = (Number(form.total_amount) || 0) - (Number(form.advance) || 0) - (Number(form.additional_payment) || 0);
  const isTailoring = (form.sale_type || 'tailoring') === 'tailoring';

  return (
    <Modal
      open={open} onClose={onClose} title={order ? 'Edit Order' : 'New Order'} size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.receipt_number || !form.customer_name}>
            {saving ? 'Saving…' : order ? 'Update Order' : 'Create Order'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!order && (
          <div className="p-3 rounded-xl border border-dashed border-sky-300 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800">
            {!!queueTotal && queueTotal > 0 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-700 dark:text-sky-300 bg-white dark:bg-sky-900 rounded-full px-2.5 py-1">
                  Receipt {queuePosition} of {queueTotal}
                </span>
                {(queuePosition || 0) < (queueTotal || 0) && (
                  <span className="text-xs text-sky-600 dark:text-sky-400">{(queueTotal || 0) - (queuePosition || 0)} more waiting</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                type="file" accept="image/*" capture="environment"
                onChange={(e) => e.target.files?.[0] && scanReceipt(e.target.files[0])}
                disabled={scanning}
                className="text-sm w-full file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white file:font-semibold hover:file:bg-sky-500 cursor-pointer disabled:opacity-60"
              />
              {scanning && <span className="text-sm text-sky-700 dark:text-sky-300 flex-shrink-0">Reading receipt…</span>}
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-300 mt-1.5">
              Snap or upload a photo of a handwritten receipt — AI will try to fill the fields below. Always review before saving.
            </p>
            {scanResult && (
              <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${
                scanResult.confidence === 'low' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  : scanResult.confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
              }`}>
                Scan confidence: <span className="font-semibold capitalize">{scanResult.confidence}</span>.
                {scanResult.uncertain.length > 0 && ` Double-check: ${scanResult.uncertain.join(', ')}.`}
                {' '}Please verify every field below before saving.
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Sale Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {SALE_TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => set('sale_type', t.value)}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  (form.sale_type || 'tailoring') === t.value
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Receipt Number *"><Input value={form.receipt_number || ''} onChange={(e) => set('receipt_number', e.target.value)} placeholder="RC-001" /></Field>
          <Field label="Customer Name *"><Input value={form.customer_name || ''} onChange={(e) => set('customer_name', e.target.value)} placeholder="John Doe" /></Field>
          <Field label="WhatsApp Number"><Input value={form.whatsapp_number || ''} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="+968..." /></Field>
          <Field label="Order Type"><Input value={form.order_type || ''} onChange={(e) => set('order_type', e.target.value)} placeholder="Kandura, Abaya..." /></Field>
          <Field label="Order Date"><Input type="date" value={form.order_date || ''} onChange={(e) => set('order_date', e.target.value)} /></Field>
          {isTailoring && <Field label="Delivery Date"><Input type="date" value={form.delivery_date || ''} onChange={(e) => set('delivery_date', e.target.value)} /></Field>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Total Amount"><Input type="number" step="0.001" value={form.total_amount ?? 0} onChange={(e) => set('total_amount', e.target.value)} /></Field>
          <Field label="Advance Paid"><Input type="number" step="0.001" value={form.advance ?? 0} onChange={(e) => set('advance', e.target.value)} /></Field>
          <Field label="Additional Payment"><Input type="number" step="0.001" value={form.additional_payment ?? 0} onChange={(e) => set('additional_payment', e.target.value)} /></Field>
        </div>

        <Field label="Payment Account">
          <PaymentAccountSelect shops={shops} accounts={accounts} value={form.payment_account_id || ''} onChange={(v) => set('payment_account_id', v || null)} />
          <p className="text-xs text-slate-500 mt-1">Where the advance / additional payment money is taken.</p>
        </Field>

        <Field label="Remaining Balance (auto)"><Input value={balance.toFixed(3)} disabled className="bg-slate-50 dark:bg-slate-900" /></Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Salesman">
            <Select value={form.salesman_id || ''} onChange={(e) => set('salesman_id', e.target.value || null)}>
              <option value="">— None —</option>
              {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority || 'normal'} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status || 'pending'} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
        </div>

        {isTailoring && (
          <>
            <Field label="Measurement Notes"><Textarea rows={2} value={form.measurement || ''} onChange={(e) => set('measurement', e.target.value)} /></Field>

            <div>
              <Label>Worker Assignments (Piece-Rate)</Label>
              <div className="space-y-3">
                {assignments.map((a, i) => {
                  const w = a.worker_id ? workers.find((x) => x.id === a.worker_id) : null;
                  const workerDesigns = w ? designs.filter((d) => d.worker_id === w.id) : [];
                  const lineTotal = (Number(a.quantity) || 0) * (Number(a.rate) || 0);
                  const needsDesignNudge = a.category === 'embroidery' && !a.design_number;
                  return (
                    <div key={i} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Select value={a.worker_id} onChange={(e) => onWorkerSelected(i, e.target.value)} className="flex-1">
                          <option value="">Select worker</option>
                          {workers.map((wk) => <option key={wk.id} value={wk.id}>{wk.name} ({wk.category})</option>)}
                        </Select>
                        <Select value={a.category} onChange={(e) => updateAssignment(i, { category: e.target.value as WorkerCategory })} className="sm:w-36">
                          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </Select>
                        <Button variant="danger" onClick={() => setAssignments((arr) => arr.filter((_, j) => j !== i))}>Remove</Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                            Design #
                            {needsDesignNudge && <span className="text-amber-600 font-normal normal-case">(recommended)</span>}
                          </label>
                          {workerDesigns.length > 0 ? (
                            <Select
                              value={a.design_number}
                              onChange={(e) => onDesignSelected(i, e.target.value)}
                              className={`text-sm ${needsDesignNudge ? 'ring-1 ring-amber-400 border-amber-400' : ''}`}
                            >
                              <option value="">— None —</option>
                              {workerDesigns.map((d) => <option key={d.id} value={d.design_number}>{d.design_number} ({d.design_name || d.design_number})</option>)}
                            </Select>
                          ) : (
                            <Input
                              value={a.design_number}
                              onChange={(e) => updateAssignment(i, { design_number: e.target.value })}
                              placeholder={needsDesignNudge ? 'Add a design #' : '—'}
                              className={`text-sm ${needsDesignNudge ? 'ring-1 ring-amber-400 border-amber-400 placeholder:text-amber-500' : ''}`}
                            />
                          )}
                          {needsDesignNudge && (
                            <p className="text-[11px] text-amber-600 mt-0.5">Embroidery work usually has a design — you can still skip it if there isn't one.</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500">Qty</label>
                          <Input type="number" min="1" value={a.quantity} onChange={(e) => updateAssignment(i, { quantity: Number(e.target.value) })} className="text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-500">Rate</label>
                          <Input type="number" step="0.001" value={a.rate} onChange={(e) => updateAssignment(i, { rate: Number(e.target.value) })} className="text-sm" />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">Total: <span className="font-bold text-slate-600 dark:text-slate-300">{fmtMoney(lineTotal)}</span></p>
                    </div>
                  );
                })}
                <Button variant="ghost" onClick={() => setAssignments((arr) => [...arr, { worker_id: '', category: 'cutting', design_number: '', quantity: 1, rate: 0 }])}>
                  + Add Worker
                </Button>
              </div>
            </div>
          </>
        )}

        <Field label="Notes"><Textarea rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <Field label="Remarks"><Input value={form.remarks || ''} onChange={(e) => set('remarks', e.target.value)} /></Field>

        <Field label="Upload Original Receipt">
          <div className="flex items-center gap-3">
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadReceipt(e.target.files[0])} className="text-sm w-full file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-semibold hover:file:bg-sky-100 cursor-pointer" />
            {uploading && <span className="text-sm text-slate-500">Uploading…</span>}
            {form.receipt_image && <img src={form.receipt_image} alt="Receipt" className="w-16 h-16 rounded-lg object-cover border" />}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
