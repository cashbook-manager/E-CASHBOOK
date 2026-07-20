import { useEffect, useState } from 'react';
import {
  Pencil, Trash2, Copy, Printer, MessageCircle, Image as ImageIcon, X,
  CheckCircle2, Circle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Order, Worker, OrderWorker, TimelineEntry, Salesman, Settings } from '../lib/types';
import { Modal, Button, Badge, Spinner } from './ui';
import { StatusBadge } from '../pages/Dashboard';
import { DigitalReceipt } from './DigitalReceipt';
import { DeliveryPaymentModal } from './DeliveryPaymentModal';
import { fmtMoney, fmtDate, fmtDateTime, daysUntil } from '../lib/format';

export function OrderDetail({
  order, onClose, onEdit, onDeleted, workers, salesmen, settings,
}: {
  order: Order;
  onClose: () => void;
  onEdit: (o: Order) => void;
  onDeleted: () => void;
  workers: Worker[];
  salesmen: Salesman[];
  settings: Settings | null;
}) {
  const [tab, setTab] = useState<'details' | 'workers' | 'timeline' | 'receipt'>('details');
  const [assignments, setAssignments] = useState<OrderWorker[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const currency = settings?.currency || 'OMR';
  const salesman = salesmen.find((s) => s.id === order.salesman_id);

  useEffect(() => {
    Promise.all([
      supabase.from('order_workers').select('*').eq('order_id', order.id).then((r) => r.data as OrderWorker[] || []),
      supabase.from('order_timeline').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).then((r) => r.data as TimelineEntry[] || []),
    ]).then(([a, t]) => {
      setAssignments(a);
      setTimeline(t);
      setLoading(false);
    });
  }, [order.id]);

  async function toggleSubmission(ow: OrderWorker) {
    const newSubmitted = !ow.submitted;
    const patch: any = {
      submitted: newSubmitted,
      submission_date: newSubmitted ? new Date().toISOString() : null,
      submission_remarks: newSubmitted ? ow.submission_remarks : '',
    };
    await supabase.from('order_workers').update(patch).eq('id', ow.id);
    setAssignments((arr) => arr.map((x) => x.id === ow.id ? { ...x, ...patch } : x));

    const w = workers.find((x) => x.id === ow.worker_id);
    const qty = Number(ow.quantity) || 1;
    const rate = Number(ow.rate) || 0;
    const amount = qty * rate;
    await supabase.from('order_timeline').insert({
      order_id: order.id,
      action: newSubmitted ? 'Worker Submitted' : 'Submission Revoked',
      detail: `${ow.category}: ${w?.name || ''}${ow.design_number ? ` · Design #${ow.design_number}` : ''} · Qty ${qty} · ${fmtMoney(amount, currency)}`,
      person: 'Admin',
    });

    // Create or delete worker_payment record (earnings only, NOT cashbook)
    if (newSubmitted) {
      await supabase.from('worker_payments').insert({
        worker_id: ow.worker_id, order_id: order.id,
        design_number: ow.design_number || '',
        receipt_number: order.receipt_number,
        submission_date: new Date().toISOString().slice(0, 10),
        price: rate, quantity: qty, amount,
        remarks: `${ow.category} work`,
      });
    } else {
      await supabase.from('worker_payments')
        .delete()
        .eq('worker_id', ow.worker_id)
        .eq('order_id', order.id)
        .eq('design_number', ow.design_number || '');
    }

    await autoUpdateStatus(order.id);
    refreshTimeline();
  }

  async function autoUpdateStatus(orderId: string) {
    const { data: ows } = await supabase.from('order_workers').select('*').eq('order_id', orderId);
    if (!ows || ows.length === 0) return;
    const all = ows as OrderWorker[];
    const embroidery = all.filter((a) => a.category === 'embroidery');
    const stitching = all.filter((a) => a.category === 'stitching');
    const allEmbroideryDone = embroidery.length > 0 && embroidery.every((a) => a.submitted);
    const allStitchingDone = stitching.length > 0 && stitching.every((a) => a.submitted);
    const allDone = all.every((a) => a.submitted);

    let newStatus: Order['status'] = 'pending';
    if (allDone) newStatus = 'ready';
    else if (allStitchingDone) newStatus = 'ready';
    else if (allEmbroideryDone) newStatus = 'stitching';
    else if (all.some((a) => a.submitted)) newStatus = 'stitching';

    await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (newStatus === 'ready') {
      await supabase.from('order_timeline').insert({
        order_id: orderId, action: 'Status: Ready', detail: 'All workers submitted', person: 'System',
      });
    }
  }

  async function duplicate() {
    const { data } = await supabase.from('orders').insert({
      receipt_number: `${order.receipt_number}-COPY`,
      customer_name: order.customer_name,
      whatsapp_number: order.whatsapp_number,
      order_type: order.order_type,
      total_amount: order.total_amount,
      advance: 0,
      salesman_id: order.salesman_id,
      priority: order.priority,
      status: 'pending',
    }).select('*').maybeSingle();
    if (data) {
      await supabase.from('order_timeline').insert({
        order_id: (data as Order).id, action: 'Order Created (Duplicate)', detail: `Copied from #${order.receipt_number}`, person: 'Admin',
      });
      onDeleted();
    }
  }

  async function del() {
    if (!confirm(`Delete order #${order.receipt_number}? This cannot be undone.`)) return;
    await supabase.from('orders').delete().eq('id', order.id);
    onDeleted();
  }

  async function refreshTimeline() {
    const { data } = await supabase.from('order_timeline').select('*').eq('order_id', order.id).order('created_at', { ascending: false });
    setTimeline(data as TimelineEntry[] || []);
  }

  const dueDays = order.delivery_date ? daysUntil(order.delivery_date) : null;

  return (
    <Modal open={true} onClose={onClose} title={`Order #${order.receipt_number}`} size="lg">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {order.receipt_image ? (
          <button onClick={() => setShowImage(true)} className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
            <img src={order.receipt_image} alt="Receipt" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
            <ImageIcon size={24} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg">{order.customer_name}</h3>
            <StatusBadge status={order.status} />
            {order.priority === 'high' && <Badge color="red">High Priority</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {order.whatsapp_number && <span>{order.whatsapp_number} · </span>}
            Due {fmtDate(order.delivery_date)}
            {dueDays !== null && (
              <span className={`ml-2 font-semibold ${dueDays < 0 ? 'text-rose-500' : dueDays <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                {dueDays < 0 ? `${Math.abs(dueDays)} days overdue` : `${dueDays} days left`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="ghost" onClick={() => onEdit(order)}><Pencil size={15} /> Edit</Button>
        <Button variant="ghost" onClick={duplicate}><Copy size={15} /> Duplicate</Button>
        <Button variant="ghost" onClick={() => setTab('receipt')}><Printer size={15} /> Receipt</Button>
        <Button variant="ghost" onClick={() => window.open(`https://wa.me/${order.whatsapp_number.replace(/[^0-9]/g, '')}`)}>
          <MessageCircle size={15} /> WhatsApp
        </Button>
        {order.status !== 'delivered' && (
          <Button variant="ghost" onClick={() => setShowDeliveryModal(true)}><CheckCircle2 size={15} /> Mark Delivered</Button>
        )}
        <Button variant="danger" onClick={del}><Trash2 size={15} /> Delete</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-800">
        {(['details', 'workers', 'timeline', 'receipt'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition border-b-2 ${
              tab === t ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t === 'workers' ? 'Workers' : t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="text-sky-600" /></div>
      ) : tab === 'details' ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <DetailRow label="Receipt #" value={order.receipt_number} />
          <DetailRow label="Customer" value={order.customer_name} />
          <DetailRow label="WhatsApp" value={order.whatsapp_number || '—'} />
          <DetailRow label="Order Type" value={order.order_type || '—'} />
          <DetailRow label="Order Date" value={fmtDate(order.order_date)} />
          <DetailRow label="Delivery Date" value={fmtDate(order.delivery_date)} />
          <DetailRow label="Total" value={fmtMoney(order.total_amount, currency)} />
          <DetailRow label="Advance" value={fmtMoney(order.advance, currency)} />
          <DetailRow label="Balance" value={fmtMoney(order.balance, currency)} />
          {order.status === 'delivered' && (
            <>
              <DetailRow label="Paid at Delivery" value={fmtMoney(order.customer_paid_now, currency)} />
              <DetailRow label="Payment Status" value={
                order.payment_status === 'paid_in_full' ? 'Paid in Full'
                  : order.payment_status === 'outstanding' ? `Outstanding (${fmtMoney(order.remaining_balance, currency)})`
                  : order.payment_status === 'written_off' ? `Written Off (${fmtMoney(order.loss_amount, currency)})`
                  : '—'
              } />
              {order.write_off && <DetailRow label="Loss Reason" value={order.loss_reason || '—'} />}
              <DetailRow label="Delivered Date" value={fmtDate(order.delivered_date)} />
              <DetailRow label="Payment Method" value={order.payment_method || '—'} />
            </>
          )}
          <DetailRow label="Salesman" value={salesman?.name || '—'} />
          <DetailRow label="Priority" value={order.priority} />
          {order.measurement && <div className="col-span-2"><DetailRow label="Measurement" value={order.measurement} /></div>}
          {order.notes && <div className="col-span-2"><DetailRow label="Notes" value={order.notes} /></div>}
          {order.remarks && <div className="col-span-2"><DetailRow label="Remarks" value={order.remarks} /></div>}
        </div>
      ) : tab === 'workers' ? (
        <div className="space-y-2">
          {assignments.length === 0 && <p className="text-center text-slate-500 py-4">No workers assigned</p>}
          {assignments.map((a) => {
            const w = workers.find((x) => x.id === a.worker_id);
            const lineTotal = (Number(a.quantity) || 0) * (Number(a.rate) || 0);
            return (
              <div key={a.id} className={`p-3 rounded-xl border ${
                a.submitted ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-900/20'
              }`}>
                <div className="flex items-center gap-3">
                  {a.submitted ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Circle className="text-rose-500" size={20} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{w?.name || 'Unknown worker'}</p>
                    <p className="text-xs text-slate-500">
                      {a.category} · {a.submitted ? `Submitted ${fmtDateTime(a.submission_date)}` : 'Pending'}
                    </p>
                  </div>
                  <Button variant={a.submitted ? 'ghost' : 'primary'} onClick={() => toggleSubmission(a)}>
                    {a.submitted ? 'Unsubmit' : 'Submit'}
                  </Button>
                </div>
                {(a.design_number || Number(a.quantity) > 1 || Number(a.rate) > 0) && (
                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                    {a.design_number && <span className="text-slate-500">Design: <span className="font-semibold text-slate-700 dark:text-slate-300">#{a.design_number}</span></span>}
                    <span className="text-slate-500">Qty: <span className="font-semibold text-slate-700 dark:text-slate-300">{a.quantity}</span></span>
                    <span className="text-slate-500">Rate: <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtMoney(Number(a.rate) || 0, currency)}</span></span>
                    <span className="ml-auto font-bold text-slate-700 dark:text-slate-200">{fmtMoney(lineTotal, currency)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : tab === 'timeline' ? (
        <div className="space-y-3">
          {timeline.length === 0 && <p className="text-center text-slate-500 py-4">No history yet</p>}
          {timeline.map((t) => (
            <div key={t.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500 mt-1.5" />
                <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="pb-3">
                <p className="font-semibold text-sm">{t.action}</p>
                {t.detail && <p className="text-xs text-slate-500">{t.detail}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(t.created_at)} · {t.person}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DigitalReceipt order={order} settings={settings} />
      )}

      {/* Full image viewer */}
      {showImage && order.receipt_image && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowImage(false)}>
          <button className="absolute top-4 right-4 text-white p-2"><X size={24} /></button>
          <img src={order.receipt_image} alt="Receipt" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Delivery payment confirmation */}
      {showDeliveryModal && (
        <DeliveryPaymentModal
          order={order}
          settings={settings}
          onClose={() => setShowDeliveryModal(false)}
          onConfirmed={() => { setShowDeliveryModal(false); onDeleted(); }}
        />
      )}
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <p className="text-xs text-slate-500 font-semibold uppercase">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}
