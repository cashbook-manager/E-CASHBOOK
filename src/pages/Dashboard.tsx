import { useMemo } from 'react';
import { useEffect, useState } from 'react';
import {
  ShoppingBag, DollarSign, TrendingUp, TrendingDown, Wallet,
  Clock, CheckCircle2, Truck, Search as SearchIcon, Package,
  Scissors, Shirt, Banknote, ArrowDownCircle, ArrowUpCircle,
  AlertOctagon, PercentCircle, History,
} from 'lucide-react';
import { StatCard, Card, Spinner, Badge } from '../components/ui';
import { BarChart, LineChart, DonutChart } from '../components/charts';
import { useDashboardData, computeStats, lastNMonths, monthKey, monthLabel } from '../lib/hooks';
import { fmtMoney, fmtDate } from '../lib/format';
import { useSettings, useSelectedBranch, filterByBranch } from '../lib/store';
import { navigate } from '../lib/router';
import { supabase } from '../lib/supabase';
import type { MoneyTransaction, Order } from '../lib/types';

export function Dashboard({ searchQuery }: { searchQuery: string }) {
  const raw = useDashboardData();
  const settings = useSettings();
  const currency = settings?.currency || 'OMR';
  const openingCash = Number(settings?.opening_cash ?? 0);
  const { branch } = useSelectedBranch();

  // Scope every dataset to the branch picked in the header switcher before anything derives from it.
  const data = useMemo(() => ({
    ...raw,
    orders: filterByBranch(raw.orders, branch),
    workers: filterByBranch(raw.workers, branch),
    salesmen: filterByBranch(raw.salesmen, branch),
    workerAdvances: filterByBranch(raw.workerAdvances, branch),
    salaryLedger: filterByBranch(raw.salaryLedger, branch),
    salesmanAdvances: filterByBranch(raw.salesmanAdvances, branch),
    cashbook: filterByBranch(raw.cashbook, branch),
  }), [raw, branch]);

  const stats = useMemo(() => computeStats(data, openingCash), [data, openingCash]);

  const charts = useMemo(() => {
    const months = lastNMonths(6);
    const salesByMonth = months.map((k) => {
      const tailoring = data.orders
        .filter((o) => o.sale_type === 'tailoring' && o.status === 'delivered' && monthKey(o.order_date) === k)
        .reduce((s, o) => s + Number(o.total_amount), 0);
      const readymade = data.orders
        .filter((o) => o.sale_type === 'readymade' && monthKey(o.order_date) === k)
        .reduce((s, o) => s + Number(o.total_amount), 0);
      const fabric = data.orders
        .filter((o) => o.sale_type === 'fabric' && monthKey(o.order_date) === k)
        .reduce((s, o) => s + Number(o.total_amount), 0);
      return { label: monthLabel(k), value: Math.round(tailoring + readymade + fabric) };
    });
    const expByMonth = months.map((k) => ({
      label: monthLabel(k),
      value: Math.round(
        data.cashbook.filter((c) => c.type === 'expense' && monthKey(c.entry_date) === k).reduce((s, c) => s + Number(c.amount), 0)
        + data.workerAdvances.filter((a) => monthKey(a.advance_date) === k).reduce((s, a) => s + Number(a.amount), 0)
        + data.salaryLedger.filter((l) => monthKey(l.payment_date) === k).reduce((s, l) => s + Number(l.amount), 0)
      ),
    }));
    const profitByMonth = months.map((k, i) => ({ label: monthLabel(k), value: Math.max(0, salesByMonth[i].value - expByMonth[i].value) }));
    const ordersByMonth = months.map((k) => ({ label: monthLabel(k), value: data.orders.filter((o) => monthKey(o.order_date) === k).length }));
    return { salesByMonth, expByMonth, profitByMonth, ordersByMonth };
  }, [data]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const match = (s: string | number | null | undefined) => s != null && String(s).toLowerCase().includes(q);

    const orders = data.orders.filter((o) =>
      match(o.receipt_number) || match(o.customer_name) || match(o.whatsapp_number) ||
      match(o.delivery_date) || match(o.total_amount) || match(o.advance) ||
      match(o.notes) || match(o.remarks) || match(o.order_type) || match(o.sale_type)
    ).slice(0, 10);
    const workers = data.workers.filter((w) => match(w.name) || match(w.whatsapp)).slice(0, 5);
    const salesmen = data.salesmen.filter((s) => match(s.name) || match(s.whatsapp)).slice(0, 5);
    const cashbook = data.cashbook.filter((c) => match(c.notes) || match(c.amount) || match(c.category)).slice(0, 5);

    return { orders, workers, salesmen, cashbook };
  }, [searchQuery, data]);

  if (data.loading) {
    return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;
  }

  if (searchResults) {
    return (
      <div className="space-y-4 animate-fade">
        <h2 className="text-lg font-bold">Search results for "{searchQuery}"</h2>
        {searchResults.orders.length === 0 && searchResults.workers.length === 0 && searchResults.salesmen.length === 0 && searchResults.cashbook.length === 0 ? (
          <Card className="p-8 text-center text-slate-500">
            <SearchIcon className="mx-auto mb-2 text-slate-300" size={32} />
            No results found
          </Card>
        ) : (
          <>
            {searchResults.orders.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Orders ({searchResults.orders.length})</p>
                <div className="space-y-1">
                  {searchResults.orders.map((o) => (
                    <button key={o.id} onClick={() => navigate('/orders')} className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                      <div>
                        <p className="font-semibold text-sm">{o.customer_name} <span className="text-slate-400">#{o.receipt_number}</span></p>
                        <p className="text-xs text-slate-500">{fmtDate(o.delivery_date)} · {fmtMoney(o.balance, currency)}</p>
                      </div>
                      <StatusBadge status={o.status} />
                    </button>
                  ))}
                </div>
              </Card>
            )}
            {searchResults.workers.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Workers</p>
                <div className="space-y-1">
                  {searchResults.workers.map((w) => (
                    <button key={w.id} onClick={() => navigate(`/worker/${w.id}`)} className="w-full p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                      <p className="font-semibold text-sm">{w.name} <Badge color="slate">{w.category}</Badge></p>
                    </button>
                  ))}
                </div>
              </Card>
            )}
            {searchResults.salesmen.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Salesmen</p>
                <div className="space-y-1">
                  {searchResults.salesmen.map((s) => (
                    <button key={s.id} onClick={() => navigate(`/salesman/${s.id}`)} className="w-full p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                      <p className="font-semibold text-sm">{s.name}</p>
                    </button>
                  ))}
                </div>
              </Card>
            )}
            {searchResults.cashbook.length > 0 && (
              <Card className="p-4">
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">Cashbook</p>
                <div className="space-y-1">
                  {searchResults.cashbook.map((c) => (
                    <div key={c.id} className="p-2">
                      <p className="font-semibold text-sm">{c.notes || c.category} <span className="text-slate-400">{fmtMoney(c.amount, currency)}</span></p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  const statusCards = [
    { label: 'Pending', count: data.orders.filter((o) => o.status === 'pending').length, color: 'rose', icon: Clock },
    { label: 'Cutting', count: data.orders.filter((o) => o.status === 'cutting').length, color: 'amber', icon: Scissors },
    { label: 'Stitching', count: data.orders.filter((o) => o.status === 'stitching').length, color: 'blue', icon: Package },
    { label: 'Ready', count: data.orders.filter((o) => o.status === 'ready').length, color: 'green', icon: CheckCircle2 },
    { label: 'Delivered', count: data.orders.filter((o) => o.status === 'delivered').length, color: 'slate', icon: Truck },
  ];

  return (
    <div className="space-y-6 animate-fade">
      {/* Business Summary — new card set */}
      <div>
        <h2 className="text-lg font-bold mb-3">Business Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Total Orders" value={stats.totalOrders} icon={<ShoppingBag size={18} />} accent="sky" />
          <StatCard label="Total Sales" value={fmtMoney(stats.totalSales, currency)} icon={<DollarSign size={18} />} accent="emerald" />
          <StatCard label="Total Expenses" value={fmtMoney(stats.totalExpenses, currency)} icon={<TrendingDown size={18} />} accent="rose" />
          <StatCard label="Profit" value={fmtMoney(stats.profit, currency)} icon={<TrendingUp size={18} />} accent="green" />
          <StatCard label="Cash in Drawer" value={fmtMoney(stats.cashInDrawer, currency)} icon={<Banknote size={18} />} accent="sky" />
          <StatCard label="Advance Received" value={fmtMoney(stats.advanceReceived, currency)} icon={<Wallet size={18} />} accent="violet" />
          <StatCard label="Customer Balance Due" value={fmtMoney(stats.customerBalanceDue, currency)} icon={<Clock size={18} />} accent="amber" />
          <StatCard label="Readymade Sales" value={fmtMoney(stats.readymadeSales, currency)} icon={<Shirt size={18} />} accent="blue" />
          <StatCard label="Fabric Sales" value={fmtMoney(stats.fabricSales, currency)} icon={<Package size={18} />} accent="slate" />
          <StatCard label="Today's Cash In" value={fmtMoney(stats.todaysCashIn, currency)} icon={<ArrowUpCircle size={18} />} accent="emerald" />
          <StatCard label="Today's Cash Out" value={fmtMoney(stats.todaysCashOut, currency)} icon={<ArrowDownCircle size={18} />} accent="rose" />
        </div>
      </div>

      {/* Delivery Payment & Loss Tracking */}
      <div>
        <h2 className="text-lg font-bold mb-3">Delivery Payments &amp; Loss Tracking</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Cash Received" value={fmtMoney(stats.cashReceived, currency)} icon={<Banknote size={18} />} accent="emerald" />
          <StatCard label="Outstanding Receivables" value={fmtMoney(stats.outstandingReceivables, currency)} icon={<Clock size={18} />} accent="amber" onClick={() => navigate('/orders')} />
          <StatCard label="Total Loss / Write-offs" value={fmtMoney(stats.totalLossWriteOffs, currency)} icon={<AlertOctagon size={18} />} accent="rose" />
          <StatCard label="Discounts Given" value={fmtMoney(stats.discountsGiven, currency)} icon={<PercentCircle size={18} />} accent="violet" />
        </div>
      </div>

      {/* Order Status Cards */}
      <div>
        <h2 className="text-lg font-bold mb-3">Order Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statusCards.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.label} onClick={() => navigate('/orders')} className="card p-4 text-left hover:shadow-md transition">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                  s.color === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                  s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  s.color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  s.color === 'green' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  <Icon size={20} />
                </div>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs font-semibold text-slate-500 uppercase">{s.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold mb-3">Monthly Sales</h3>
          <LineChart data={charts.salesByMonth} color="#0ea5e9" />
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-3">Monthly Expenses</h3>
          <BarChart data={charts.expByMonth} color="#f43f5e" />
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-3">Monthly Profit</h3>
          <LineChart data={charts.profitByMonth} color="#10b981" />
        </Card>
        <Card className="p-5">
          <h3 className="font-bold mb-3">Orders Per Month</h3>
          <BarChart data={charts.ordersByMonth} color="#0ea5e9" />
        </Card>
      </div>

      {/* Sales breakdown donut */}
      <Card className="p-5">
        <h3 className="font-bold mb-4">Sales Breakdown</h3>
        <DonutChart
          segments={[
            { label: 'Tailoring', value: Math.round(stats.tailoringSales), color: '#0ea5e9' },
            { label: 'Readymade', value: Math.round(stats.readymadeSales), color: '#8b5cf6' },
            { label: 'Fabric', value: Math.round(stats.fabricSales), color: '#f59e0b' },
          ]}
        />
      </Card>

      <PaymentCollectionHistory currency={currency} branch={branch} />
    </div>
  );
}

function PaymentCollectionHistory({ currency, branch }: { currency: string; branch: string }) {
  const [txns, setTxns] = useState<MoneyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let query = supabase
      .from('money_transactions')
      .select('*')
      .eq('category', 'delivered_payment');
    if (branch !== 'all') query = query.eq('shop_id', branch);
    query
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        setTxns((data as MoneyTransaction[]) || []);
        setLoading(false);
      });
  }, [branch]);

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
        <History size={18} className="text-sky-600" />
        <h3 className="font-bold">Payment Collection History</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner className="text-sky-600" /></div>
      ) : txns.length === 0 ? (
        <p className="p-8 text-center text-slate-500 text-sm">No delivery payments recorded yet</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {txns.map((t) => (
            <div key={t.id} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t.notes || 'Delivery payment'}</p>
                <p className="text-xs text-slate-500">{fmtDate(t.entry_date)}</p>
              </div>
              <p className="font-bold text-emerald-600 flex-shrink-0">{fmtMoney(t.amount, currency)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function StatusBadge({ status }: { status: Order['status'] }) {
  const map: Record<string, { color: 'rose' | 'amber' | 'blue' | 'green' | 'slate'; label: string }> = {
    pending: { color: 'rose', label: 'Pending' },
    cutting: { color: 'amber', label: 'Cutting' },
    stitching: { color: 'blue', label: 'Stitching' },
    ready: { color: 'green', label: 'Ready' },
    delivered: { color: 'slate', label: 'Delivered' },
  };
  const s = map[status] || map.pending;
  return <Badge color={s.color}>{s.label}</Badge>;
}
