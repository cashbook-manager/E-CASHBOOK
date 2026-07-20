import { useRef } from 'react';
import { Scissors, MessageCircle, Printer, Share2, QrCode } from 'lucide-react';
import type { Order, Settings } from '../lib/types';
import { fmtMoney, fmtDate, printHTML } from '../lib/format';

export function DigitalReceipt({ order, settings }: { order: Order; settings: Settings | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const currency = settings?.currency || 'OMR';

  const share = async () => {
    const text = `Receipt #${order.receipt_number}\n${order.customer_name}\nTotal: ${fmtMoney(order.total_amount, currency)}\nAdvance: ${fmtMoney(order.advance, currency)}\nBalance: ${fmtMoney(order.balance, currency)}\nDelivery: ${fmtDate(order.delivery_date)}`;
    if (navigator.share) {
      navigator.share({ title: `Receipt #${order.receipt_number}`, text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Receipt details copied to clipboard');
    }
  };

  const print = () => {
    const body = `
    <style>
      .receipt{max-width:400px;margin:0 auto}
      .header{text-align:center;margin-bottom:16px}
      .logo{width:48px;height:48px;background:#0284c7;border-radius:12px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb;font-size:14px}
      .label{color:#6b7280}.val{font-weight:600}
      .total{background:#f0f9ff;padding:12px;border-radius:8px;margin-top:12px;text-align:center}
      .btns{margin-top:16px;display:flex;gap:8px;justify-content:center}
      .btn{padding:8px 16px;border-radius:8px;border:none;font-weight:600;cursor:pointer}
      @media print{.btns{display:none}}
    </style>
    <div class="receipt">
    <div class="header">
      <div class="logo">✂</div>
      <h1 style="margin:0;font-size:18px">${settings?.shop_name || 'Tailor Shop'}</h1>
      <p style="margin:4px 0 0;color:#6b7280;font-size:12px">${settings?.phone || ''}</p>
    </div>
    <div class="row"><span class="label">Receipt #</span><span class="val">${order.receipt_number}</span></div>
    <div class="row"><span class="label">Customer</span><span class="val">${order.customer_name}</span></div>
    <div class="row"><span class="label">Phone</span><span class="val">${order.whatsapp_number || '—'}</span></div>
    <div class="row"><span class="label">Order Date</span><span class="val">${fmtDate(order.order_date)}</span></div>
    <div class="row"><span class="label">Delivery Date</span><span class="val">${fmtDate(order.delivery_date)}</span></div>
    <div class="row"><span class="label">Total Amount</span><span class="val">${fmtMoney(order.total_amount, currency)}</span></div>
    <div class="row"><span class="label">Advance</span><span class="val">${fmtMoney(order.advance, currency)}</span></div>
    <div class="total"><div class="label">Balance Due</div><div style="font-size:24px;font-weight:700">${fmtMoney(order.balance, currency)}</div></div>
    <div style="text-align:center;margin-top:16px"><div style="display:inline-block;padding:8px;border:1px solid #ddd;border-radius:8px;font-family:monospace">${order.receipt_number}-${order.customer_name.slice(0,3).toUpperCase()}</div></div>
    </div>`;
    printHTML(`Receipt #${order.receipt_number}`, body);
  };

  return (
    <div ref={ref} className="max-w-sm mx-auto">
      <div className="text-center mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white mx-auto mb-2">
          <Scissors size={24} />
        </div>
        <h3 className="font-bold text-lg">{settings?.shop_name || 'Tailor Shop'}</h3>
        <p className="text-xs text-slate-500">{settings?.phone || ''}</p>
      </div>
      <div className="space-y-1 text-sm">
        <ReceiptRow label="Receipt #" value={order.receipt_number} />
        <ReceiptRow label="Customer" value={order.customer_name} />
        <ReceiptRow label="Phone" value={order.whatsapp_number || '—'} />
        <ReceiptRow label="Order Date" value={fmtDate(order.order_date)} />
        <ReceiptRow label="Delivery Date" value={fmtDate(order.delivery_date)} />
        <ReceiptRow label="Total" value={fmtMoney(order.total_amount, currency)} />
        <ReceiptRow label="Advance" value={fmtMoney(order.advance, currency)} />
      </div>
      <div className="mt-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-center">
        <p className="text-xs text-slate-500 font-semibold uppercase">Balance Due</p>
        <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{fmtMoney(order.balance, currency)}</p>
      </div>
      <div className="mt-3 flex items-center justify-center">
        <div className="p-2 border-2 border-slate-200 dark:border-slate-700 rounded-lg">
          <QrCode size={48} className="text-slate-400" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => window.open(`https://wa.me/${order.whatsapp_number.replace(/[^0-9]/g, '')}`)} className="flex-1 btn bg-green-500 text-white hover:bg-green-600">
          <MessageCircle size={16} /> WhatsApp
        </button>
        <button onClick={print} className="flex-1 btn bg-sky-600 text-white hover:bg-sky-500">
          <Printer size={16} /> Print
        </button>
        <button onClick={share} className="flex-1 btn bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
          <Share2 size={16} /> Share
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-dashed border-slate-200 dark:border-slate-800">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}