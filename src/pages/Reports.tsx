import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, FileBarChart, Store } from 'lucide-react';
import { useDashboardData, computeStats, monthKey } from '../lib/hooks';
import { useSettings } from '../lib/store';
import { supabase } from '../lib/supabase';
import type { Shop, MoneyTransaction } from '../lib/types';
import { Card, Input, Spinner } from '../components/ui';
import { fmtMoney, fmtDate, exportCSV, printHTML } from '../lib/format';

type ReportTab = 'daily' | 'monthly' | 'yearly';

type MetricKey =
  | 'orders' | 'sales' | 'readymade' | 'fabric' | 'advances' | 'balanceDue'
  | 'cashIn' | 'cashOut' | 'expenses' | 'profit' | 'cashDrawer'
  | 'workerAdvances' | 'salaryPaid' | 'delivered' | 'notDelivered'
  | 'cashReceived' | 'outstandingReceivables' | 'lossWriteoffs' | 'discounts';

function isToday(d: string | null | undefined): boolean {
  if (!d) return false;
  const dt = new Date(d);
  const now = new Date();
  return dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();
}

export function Reports() {
  const data = useDashboardData();
  const settings = useSettings();
  const currency = settings?.currency || 'OMR';
  const openingCash = Number(settings?.opening_cash ?? 0);
  const [tab, setTab] = useState<ReportTab>('daily');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [monthSel, setMonthSel] = useState('');
  const [yearSel, setYearSel] = useState('');

  const filtered = useMemo(() => {
    const f = from ? new Date(from) : null;
    const t = to ? new Date(to) : null;
    if (f) f.setHours(0, 0, 0, 0);
    if (t) t.setHours(23, 59, 59, 999);
    const inRange = (d: string) => {
      const dt = new Date(d);
      if (f && dt < f) return false;
      if (t && dt > t) return false;
      return true;
    };

    let orders = data.orders.filter((o) => inRange(o.order_date));
    let cashbook = data.cashbook.filter((c) => inRange(c.entry_date));
    let workerAdvances = data.workerAdvances.filter((a) => inRange(a.advance_date));
    let salaryLedger = data.salaryLedger.filter((l) => inRange(l.payment_date));
    let salesmanAdvances = data.salesmanAdvances.filter((a) => inRange(a.advance_date));

    if (tab === 'monthly' && monthSel) {
      orders = data.orders.filter((o) => monthKey(o.order_date) === monthSel);
      cashbook = data.cashbook.filter((c) => monthKey(c.entry_date) === monthSel);
      workerAdvances = data.workerAdvances.filter((a) => monthKey(a.advance_date) === monthSel);
      salaryLedger = data.salaryLedger.filter((l) => monthKey(l.payment_date) === monthSel);
      salesmanAdvances = data.salesmanAdvances.filter((a) => monthKey(a.advance_date) === monthSel);
    }

    if (tab === 'yearly' && yearSel) {
      orders = data.orders.filter((o) => new Date(o.order_date).getFullYear() === Number(yearSel));
      cashbook = data.cashbook.filter((c) => new Date(c.entry_date).getFullYear() === Number(yearSel));
      workerAdvances = data.workerAdvances.filter((a) => new Date(a.advance_date).getFullYear() === Number(yearSel));
      salaryLedger = data.salaryLedger.filter((l) => new Date(l.payment_date).getFullYear() === Number(yearSel));
      salesmanAdvances = data.salesmanAdvances.filter((a) => new Date(a.advance_date).getFullYear() === Number(yearSel));
    }

    return { orders, cashbook, workerAdvances, salaryLedger, salesmanAdvances };
  }, [data, from, to, tab, monthSel, yearSel]);

  const stats = useMemo(() => computeStats(filtered, openingCash), [filtered, openingCash]);

  const periodLabel = tab === 'daily'
    ? `${from || 'All'} to ${to || 'Today'}`
    : tab === 'monthly'
    ? monthSel || 'All Months'
    : yearSel || 'All Years';

  const shop = settings?.shop_name || 'Tailor Shop';

  // ── Per-card detail rows (used for both the individual Excel export and the individual PDF) ──

  const salesOrders = filtered.orders.filter(
    (o) => (o.sale_type === 'tailoring' && o.status === 'delivered') || o.sale_type === 'readymade' || o.sale_type === 'fabric'
  );
  const advanceOrders = filtered.orders.filter((o) => Number(o.advance) > 0);
  const balanceDueOrders = filtered.orders.filter((o) => o.sale_type === 'tailoring' && o.status !== 'delivered');
  const cashInEntries = filtered.cashbook.filter((c) => c.type === 'income' && isToday(c.entry_date));
  const cashOutEntries = filtered.cashbook.filter((c) => c.type === 'expense' && isToday(c.entry_date));
  const expenseEntries = filtered.cashbook.filter((c) => c.type === 'expense');
  const salaryEntries = filtered.salaryLedger.filter((l) => l.type !== 'advance');
  const deliveredOrders = filtered.orders.filter((o) => o.status === 'delivered');
  const notDeliveredOrders = filtered.orders.filter((o) => o.status !== 'delivered');

  const orderRow = (o: typeof filtered.orders[number]) => [
    o.receipt_number, o.customer_name, o.sale_type, fmtDate(o.order_date), fmtDate(o.delivery_date),
    o.total_amount, o.advance, o.balance, o.status,
  ];
  const orderHeader = ['Receipt #', 'Customer', 'Type', 'Order Date', 'Delivery Date', 'Total', 'Advance', 'Balance', 'Status'];

  interface MetricDef {
    key: MetricKey;
    label: string;
    value: string | number;
    accent: string;
    header: (string | number)[];
    rows: (string | number)[][];
  }

  function metricsFor(activeTab: ReportTab): MetricDef[] {
    const base: MetricDef[] = [
      {
        key: 'orders', label: 'Total Orders', value: stats.totalOrders, accent: 'sky',
        header: orderHeader, rows: filtered.orders.map(orderRow),
      },
      {
        key: 'sales', label: 'Total Sales', value: fmtMoney(stats.totalSales, currency), accent: 'emerald',
        header: orderHeader, rows: salesOrders.map(orderRow),
      },
      {
        key: 'readymade', label: 'Readymade Sales', value: fmtMoney(stats.readymadeSales, currency), accent: 'blue',
        header: orderHeader, rows: filtered.orders.filter((o) => o.sale_type === 'readymade').map(orderRow),
      },
      {
        key: 'fabric', label: 'Fabric Sales', value: fmtMoney(stats.fabricSales, currency), accent: 'slate',
        header: orderHeader, rows: filtered.orders.filter((o) => o.sale_type === 'fabric').map(orderRow),
      },
      {
        key: 'advances', label: 'Advances Received', value: fmtMoney(stats.advanceReceived, currency), accent: 'sky',
        header: ['Receipt #', 'Customer', 'Order Date', 'Advance'],
        rows: advanceOrders.map((o) => [o.receipt_number, o.customer_name, fmtDate(o.order_date), o.advance]),
      },
      {
        key: 'balanceDue', label: 'Customer Balance Due', value: fmtMoney(stats.customerBalanceDue, currency), accent: 'amber',
        header: ['Receipt #', 'Customer', 'Total', 'Advance', 'Additional Payment', 'Balance'],
        rows: balanceDueOrders.map((o) => [o.receipt_number, o.customer_name, o.total_amount, o.advance, o.additional_payment, o.balance]),
      },
      {
        key: 'cashIn', label: "Today's Cash In", value: fmtMoney(stats.todaysCashIn, currency), accent: 'emerald',
        header: ['Date', 'Category', 'Notes', 'Amount'],
        rows: cashInEntries.map((c) => [fmtDate(c.entry_date), c.category.replace(/_/g, ' '), c.notes || '', c.amount]),
      },
      {
        key: 'cashOut', label: "Today's Cash Out", value: fmtMoney(stats.todaysCashOut, currency), accent: 'rose',
        header: ['Date', 'Category', 'Notes', 'Amount'],
        rows: cashOutEntries.map((c) => [fmtDate(c.entry_date), c.category.replace(/_/g, ' '), c.notes || '', c.amount]),
      },
      {
        key: 'expenses', label: 'Expenses', value: fmtMoney(stats.totalExpenses, currency), accent: 'rose',
        header: ['Date', 'Category', 'Notes', 'Amount'],
        rows: expenseEntries.map((c) => [fmtDate(c.entry_date), c.category.replace(/_/g, ' '), c.notes || '', c.amount]),
      },
      {
        key: 'profit', label: 'Profit', value: fmtMoney(stats.profit, currency), accent: 'green',
        header: ['Metric', 'Value'],
        rows: [
          ['Total Sales', fmtMoney(stats.totalSales, currency)],
          ['Total Expenses', fmtMoney(stats.totalExpenses, currency)],
          ['Profit', fmtMoney(stats.profit, currency)],
        ],
      },
      {
        key: 'cashDrawer', label: 'Cash Drawer', value: fmtMoney(stats.cashInDrawer, currency), accent: 'sky',
        header: ['Metric', 'Value'],
        rows: [
          ['Opening Cash', fmtMoney(openingCash, currency)],
          ["Today's Cash In", fmtMoney(stats.todaysCashIn, currency)],
          ["Today's Cash Out", fmtMoney(stats.todaysCashOut, currency)],
          ['Cash in Drawer', fmtMoney(stats.cashInDrawer, currency)],
        ],
      },
      {
        key: 'workerAdvances', label: 'Worker Advances', value: fmtMoney(stats.workerAdvancesTotal, currency), accent: 'amber',
        header: ['Worker', 'Date', 'Amount', 'Remarks'],
        rows: filtered.workerAdvances.map((a) => {
          const w = data.workers.find((x) => x.id === a.worker_id);
          return [w?.name || '—', fmtDate(a.advance_date), a.amount, a.remarks || ''];
        }),
      },
      {
        key: 'salaryPaid', label: 'Salary Paid', value: fmtMoney(stats.salaryPaidTotal, currency), accent: 'violet',
        header: ['Salesman', 'Date', 'Type', 'Amount', 'Remarks'],
        rows: [
          ...salaryEntries.map((l) => {
            const s = data.salesmen.find((x) => x.id === l.salesman_id);
            return [s?.name || '—', fmtDate(l.payment_date), 'Salary', l.amount, l.remarks || ''];
          }),
          ...filtered.salesmanAdvances.map((a) => {
            const s = data.salesmen.find((x) => x.id === a.salesman_id);
            return [s?.name || '—', fmtDate(a.advance_date), 'Advance', a.amount, a.remarks || ''];
          }),
        ],
      },
    ];

    if (activeTab === 'monthly' || activeTab === 'yearly') {
      base.splice(1, 0, {
        key: 'delivered', label: 'Delivered Orders', value: stats.deliveredCount, accent: 'slate',
        header: orderHeader, rows: deliveredOrders.map(orderRow),
      });
    }
    if (activeTab === 'daily') {
      base.push({
        key: 'notDelivered', label: 'Not Delivered', value: stats.notDeliveredCount, accent: 'orange',
        header: orderHeader, rows: notDeliveredOrders.map(orderRow),
      });
    }
    return base;
  }

  const activeMetrics = metricsFor(tab);

  function exportMetric(m: MetricDef) {
    const rows: (string | number)[][] = [
      [shop, m.label], ['Period', periodLabel], [],
      m.header,
      ...m.rows,
    ];
    exportCSV(`${m.key}-${tab}-report.csv`, rows);
  }

  function printMetric(m: MetricDef) {
    const body = `
      <h1>${shop} — ${m.label}</h1>
      <h2>Period: ${periodLabel}</h2>
      <p style="margin:0 0 12px;font-size:15px"><strong>${m.label}: ${m.value}</strong></p>
      <table><tr>${m.header.map((h) => `<th>${h}</th>`).join('')}</tr>
      ${m.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </table>`;
    printHTML(m.label, body);
  }

  function exportFullReport() {
    const rows: (string | number)[][] = [
      [shop, `${tab.charAt(0).toUpperCase() + tab.slice(1)} Report`],
      ['Period', periodLabel], [],
      ['Metric', 'Value'],
      ...activeMetrics.map((m) => [m.label, m.value]),
      [],
      orderHeader,
      ...filtered.orders.map(orderRow),
    ];
    exportCSV(`${tab}-report.csv`, rows);
  }

  function printFullReport() {
    const body = `
      <h1>${shop} — ${tab.charAt(0).toUpperCase() + tab.slice(1)} Report</h1>
      <h2>Period: ${periodLabel}</h2>
      <table><tr><th>Metric</th><th class="right">Value</th></tr>
      ${activeMetrics.map((m) => `<tr><td>${m.label}</td><td class="right">${m.value}</td></tr>`).join('')}
      </table>
      <h3 style="margin-top:24px">Orders</h3>
      <table><tr>${orderHeader.map((h) => `<th>${h}</th>`).join('')}</tr>
      ${filtered.orders.map((o) => `<tr>${orderRow(o).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
      </table>`;
    printHTML(`${tab} Report`, body);
  }

  const accentBg: Record<string, string> = {
    sky: 'from-sky-50 to-sky-100/50 dark:from-sky-950/30 dark:to-sky-900/10 border-sky-200 dark:border-sky-900',
    emerald: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-900',
    rose: 'from-rose-50 to-rose-100/50 dark:from-rose-950/30 dark:to-rose-900/10 border-rose-200 dark:border-rose-900',
    amber: 'from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10 border-amber-200 dark:border-amber-900',
    violet: 'from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/10 border-violet-200 dark:border-violet-900',
    green: 'from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/10 border-green-200 dark:border-green-900',
    slate: 'from-slate-50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-800/10 border-slate-200 dark:border-slate-700',
    orange: 'from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/10 border-orange-200 dark:border-orange-900',
    blue: 'from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-900',
  };
  const iconColor: Record<string, string> = {
    sky: 'text-sky-600', emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600',
    violet: 'text-violet-600', green: 'text-green-600', slate: 'text-slate-600', orange: 'text-orange-600', blue: 'text-blue-600',
  };

  if (data.loading) return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;

  return (
    <div className="space-y-4 animate-fade">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">Reports</h2>
        <div className="flex gap-2">
          <button onClick={exportFullReport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <Download size={16} /> Full Excel
          </button>
          <button onClick={printFullReport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <Printer size={16} /> Full PDF
          </button>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(['daily', 'monthly', 'yearly'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition ${
              tab === t ? 'border-sky-500 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500'
            }`}>
            {t} Report
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        {tab === 'daily' && (
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
            <div>
              <label className="label">From Date</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">To Date</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
        {tab === 'monthly' && (
          <div>
            <label className="label">Month</label>
            <Input type="month" value={monthSel} onChange={(e) => setMonthSel(e.target.value)} />
          </div>
        )}
        {tab === 'yearly' && (
          <div>
            <label className="label">Year</label>
            <Input type="number" min="2020" max="2099" value={yearSel} onChange={(e) => setYearSel(e.target.value)} placeholder="2026" />
          </div>
        )}
      </Card>

      {/* Individual metric cards — each with its own Excel + PDF export */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeMetrics.map((m) => (
          <div
            key={m.key}
            className={`rounded-xl border bg-gradient-to-br ${accentBg[m.accent]} p-4 flex items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm ${iconColor[m.accent]}`}>
                <FileBarChart size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">{m.label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{m.value}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => exportMetric(m)} title="Export Excel" className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition">
                <Download size={15} />
              </button>
              <button onClick={() => printMetric(m)} title="Export PDF" className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 transition">
                <Printer size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <BranchReports currency={currency} />

      {/* Orders table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold">Orders in Period</h3>
        </div>
        {filtered.orders.length === 0 ? (
          <p className="p-8 text-center text-slate-500 text-sm">No orders in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left p-3">Receipt #</th>
                  <th className="text-left p-3">Customer</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Order Date</th>
                  <th className="text-left p-3">Delivery</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Advance</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="p-3 font-mono text-xs">{o.receipt_number}</td>
                    <td className="p-3">{o.customer_name}</td>
                    <td className="p-3 capitalize">{o.sale_type}</td>
                    <td className="p-3">{fmtDate(o.order_date)}</td>
                    <td className="p-3">{fmtDate(o.delivery_date)}</td>
                    <td className="p-3 text-right">{fmtMoney(o.total_amount, currency)}</td>
                    <td className="p-3 text-right">{fmtMoney(o.advance, currency)}</td>
                    <td className="p-3 text-right font-bold">{fmtMoney(o.balance, currency)}</td>
                    <td className="p-3 capitalize">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

type TxnRow = MoneyTransaction & { payment_account?: { type: string } | null };

function BranchReports({ currency }: { currency: string }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('shops').select('*').order('created_at').then((r) => r.data as Shop[] || []),
      supabase.from('money_transactions').select('*, payment_account:payment_accounts(type)').then((r) => r.data as TxnRow[] || []),
    ]).then(([s, t]) => { setShops(s); setTxns(t); setLoading(false); });
  }, []);

  if (loading || shops.length <= 1) return null;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <Store size={18} className="text-sky-600" />
        <h3 className="font-bold">Branch Reports</h3>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {shops.map((shop) => {
          const shopTxns = txns.filter((t) => t.shop_id === shop.id);
          const inTxns = shopTxns.filter((t) => t.direction === 'in');
          const sales = inTxns.reduce((s, t) => s + Number(t.amount), 0);
          const cash = inTxns.filter((t) => t.payment_account?.type === 'cash').reduce((s, t) => s + Number(t.amount), 0);
          const bank = inTxns.filter((t) => t.payment_account?.type === 'bank').reduce((s, t) => s + Number(t.amount), 0);
          const pos = inTxns.filter((t) => t.payment_account?.type === 'pos').reduce((s, t) => s + Number(t.amount), 0);
          const outTxns = shopTxns.filter((t) => t.direction === 'out');
          const expenses = outTxns.filter((t) => t.source_type === 'expense' || t.source_type === 'manual').reduce((s, t) => s + Number(t.amount), 0);
          const salary = outTxns.filter((t) => t.source_type === 'salary' || t.source_type === 'advance').reduce((s, t) => s + Number(t.amount), 0);
          const profit = sales - expenses - salary;
          return (
            <div key={shop.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="font-bold mb-3">{shop.name}</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
                <BranchMetric label="Sales" value={fmtMoney(sales, currency)} />
                <BranchMetric label="Cash" value={fmtMoney(cash, currency)} />
                <BranchMetric label="Bank" value={fmtMoney(bank, currency)} />
                <BranchMetric label="POS" value={fmtMoney(pos, currency)} />
                <BranchMetric label="Expenses" value={fmtMoney(expenses, currency)} />
                <BranchMetric label="Salary" value={fmtMoney(salary, currency)} />
                <div className="col-span-2 pt-2 mt-1 border-t border-slate-200 dark:border-slate-800">
                  <BranchMetric label="Profit" value={fmtMoney(profit, currency)} highlight />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BranchMetric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 font-semibold uppercase">{label}</p>
      <p className={highlight ? 'font-bold text-lg text-emerald-600' : 'font-semibold'}>{value}</p>
    </div>
  );
}