import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Order, Salesman, Settings } from '../lib/types';
import { Card, Button, Input, Select, EmptyState, Spinner } from '../components/ui';
import { StatusBadge } from './Dashboard';
import { OrderForm } from '../components/OrderForm';
import { OrderDetail } from '../components/OrderDetail';
import { useDashboardData } from '../lib/hooks';
import { fmtMoney, fmtDate, daysUntil } from '../lib/format';
import { useSettings, useSelectedBranch, filterByBranch } from '../lib/store';

const STATUS_FILTERS = ['all', 'pending', 'cutting', 'stitching', 'ready', 'delivered'] as const;
const SALE_TYPE_FILTERS = ['all', 'tailoring', 'readymade', 'fabric'] as const;

export function Orders() {
  const data = useDashboardData();
  const settings = useSettings();
  const { branch } = useSelectedBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState<typeof SALE_TYPE_FILTERS[number]>('all');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => {
    supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data: d }) => {
      setOrders((d as Order[]) || []);
      setLoading(false);
    });
  }, [data]);

  const filtered = useMemo(() => {
    let r = filterByBranch(orders, branch);
    if (filter !== 'all') r = r.filter((o) => o.status === filter);
    if (saleTypeFilter !== 'all') r = r.filter((o) => o.sale_type === saleTypeFilter);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((o) =>
        o.receipt_number.toLowerCase().includes(s) ||
        o.customer_name.toLowerCase().includes(s) ||
        o.whatsapp_number.includes(s)
      );
    }
    return r;
  }, [orders, branch, filter, saleTypeFilter, q]);

  function refresh() {
    supabase.from('orders').select('*').order('created_at', { ascending: false }).then(({ data: d }) => {
      setOrders((d as Order[]) || []);
    });
    data.refresh();
  }

  return (
    <div className="space-y-4 animate-fade">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold">Orders</h2>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={18} /> New Order
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders…" className="pl-10" />
        </div>
        <Select value={saleTypeFilter} onChange={(e) => setSaleTypeFilter(e.target.value as any)} className="w-40">
          {SALE_TYPE_FILTERS.map((f) => <option key={f} value={f}>{f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </Select>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === f ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<ShoppingBag />} title="No orders found" subtitle="Create your first order to get started" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} settings={settings} salesmen={data.salesmen} onClick={() => setSelected(o)} />
          ))}
        </div>
      )}

      {formOpen && (
        <OrderForm
          open={formOpen}
          order={editing}
          salesmen={data.salesmen}
          workers={data.workers}
          onClose={() => setFormOpen(false)}
          onSaved={refresh}
        />
      )}
      {selected && (
        <OrderDetail
          order={selected}
          workers={data.workers}
          salesmen={data.salesmen}
          settings={settings}
          onClose={() => setSelected(null)}
          onEdit={(o) => { setSelected(null); setEditing(o); setFormOpen(true); }}
          onDeleted={() => { setSelected(null); refresh(); }}
        />
      )}
    </div>
  );
}

function OrderCard({ order, settings, salesmen, onClick }: {
  order: Order; settings: Settings | null; salesmen: Salesman[]; onClick: () => void;
}) {
  const currency = settings?.currency || 'OMR';
  const dueDays = order.delivery_date ? daysUntil(order.delivery_date) : null;
  const salesman = salesmen.find((s) => s.id === order.salesman_id);

  const borderColor = order.status === 'ready' ? 'border-l-emerald-500'
    : order.status === 'delivered' ? 'border-l-slate-400'
    : order.status === 'stitching' ? 'border-l-blue-500'
    : order.status === 'cutting' ? 'border-l-amber-500'
    : 'border-l-rose-500';

  const typeBadge: Record<string, string> = {
    tailoring: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    readymade: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    fabric: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <button onClick={onClick} className={`card p-4 text-left hover:shadow-md transition border-l-4 ${borderColor}`}>
      <div className="flex gap-3">
        {order.receipt_image ? (
          <img src={order.receipt_image} alt="Receipt" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
            <ShoppingBag size={20} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm truncate">{order.customer_name}</p>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">#{order.receipt_number} · {order.whatsapp_number || 'No phone'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${typeBadge[order.sale_type] || typeBadge.tailoring}`}>
              {order.sale_type}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-xs text-slate-500">
                {order.status === 'delivered' ? (order.payment_status === 'written_off' ? 'Written Off' : order.payment_status === 'outstanding' ? 'Outstanding' : 'Balance') : 'Balance'}
              </p>
              <p className={`font-bold text-sm ${order.status === 'delivered' && order.payment_status === 'written_off' ? 'text-rose-500' : order.status === 'delivered' && order.payment_status === 'outstanding' ? 'text-amber-500' : ''}`}>
                {order.status === 'delivered'
                  ? fmtMoney(order.payment_status === 'written_off' ? order.loss_amount : order.remaining_balance, currency)
                  : fmtMoney(order.balance, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Delivery</p>
              <p className={`text-sm font-semibold ${dueDays !== null && dueDays < 0 ? 'text-rose-500' : ''}`}>
                {fmtDate(order.delivery_date)}
              </p>
            </div>
          </div>
          {salesman && <p className="text-xs text-slate-400 mt-1.5">Salesman: {salesman.name}</p>}
        </div>
      </div>
    </button>
  );
}
