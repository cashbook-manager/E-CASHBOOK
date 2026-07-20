import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShoppingBag, Scissors } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Order, Salesman, Worker, Settings as SettingsType } from '../lib/types';
import { Card, Button, Input, Select, EmptyState, Spinner } from '../components/ui';
import { OrderForm } from '../components/OrderForm';
import { OrderDetail } from '../components/OrderDetail';
import { fmtDate, daysUntil } from '../lib/format';
import { useSettings } from '../lib/store';
import { navigate } from '../lib/router';

const STATUS_FILTERS = ['all', 'pending', 'cutting', 'stitching', 'ready', 'delivered'] as const;
const SALE_TYPE_FILTERS = ['all', 'tailoring', 'readymade', 'fabric'] as const;

export function SalesmanView() {
  const settings = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState<typeof SALE_TYPE_FILTERS[number]>('all');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);

  function refresh() {
    Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }).then((r) => r.data as Order[] || []),
      supabase.from('salesmen').select('*').then((r) => r.data as Salesman[] || []),
      supabase.from('workers').select('*').then((r) => r.data as Worker[] || []),
    ]).then(([o, s, w]) => {
      setOrders(o); setSalesmen(s); setWorkers(w); setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    let r = orders;
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
  }, [orders, filter, saleTypeFilter, q]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-16 max-w-7xl mx-auto">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white shadow-lg shadow-sky-600/30">
            <Scissors size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{settings?.shop_name || 'Tailor Shop'}</p>
            <p className="text-xs text-slate-500">Salesman Portal</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-semibold text-sky-600 hover:text-sky-500 px-3 py-2 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-900/20 transition"
          >
            Admin Login
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 animate-fade">
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search receipts, customers, phones…" className="pl-10" />
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
          <Card><EmptyState icon={<ShoppingBag />} title="No orders found" subtitle="Create a new order to get started" /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((o) => (
              <SalesmanOrderCard key={o.id} order={o} settings={settings} salesmen={salesmen} onClick={() => setSelected(o)} />
            ))}
          </div>
        )}

        {formOpen && (
          <OrderForm
            open={formOpen}
            order={editing}
            salesmen={salesmen}
            workers={workers}
            onClose={() => setFormOpen(false)}
            onSaved={refresh}
          />
        )}
        {selected && (
          <OrderDetail
            order={selected}
            workers={workers}
            salesmen={salesmen}
            settings={settings}
            onClose={() => setSelected(null)}
            onEdit={(o) => { setSelected(null); setEditing(o); setFormOpen(true); }}
            onDeleted={() => { setSelected(null); refresh(); }}
          />
        )}
      </main>
    </div>
  );
}

function SalesmanOrderCard({ order, salesmen, onClick }: {
  order: Order; settings: SettingsType | null; salesmen: Salesman[]; onClick: () => void;
}) {
  const dueDays = order.delivery_date ? daysUntil(order.delivery_date) : null;
  const salesman = salesmen.find((s) => s.id === order.salesman_id);

  const statusColor: Record<string, string> = {
    pending: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    cutting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    stitching: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    delivered: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };

  const typeBadge: Record<string, string> = {
    tailoring: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    readymade: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    fabric: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <button onClick={onClick} className="card p-4 text-left hover:shadow-md transition">
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
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${statusColor[order.status] || statusColor.pending}`}>
              {order.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">#{order.receipt_number} · {order.whatsapp_number || 'No phone'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${typeBadge[order.sale_type] || typeBadge.tailoring}`}>
              {order.sale_type}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-xs text-slate-500">Delivery</p>
              <p className={`text-sm font-semibold ${dueDays !== null && dueDays < 0 ? 'text-rose-500' : ''}`}>
                {fmtDate(order.delivery_date)}
              </p>
            </div>
            {salesman && <p className="text-xs text-slate-400">Salesman: {salesman.name}</p>}
          </div>
        </div>
      </div>
    </button>
  );
}
