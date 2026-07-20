import { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useDashboardData } from '../lib/hooks';
import { useSettings } from '../lib/store';
import { fmtDate, fmtMoney, daysUntil } from '../lib/format';
import { Card, EmptyState } from '../components/ui';
import { StatusBadge } from './Dashboard';
import { OrderDetail } from '../components/OrderDetail';
import { navigate } from '../lib/router';
import type { Order } from '../lib/types';

export function Alerts() {
  const data = useDashboardData();
  const settings = useSettings();
  const [selected, setSelected] = useState<Order | null>(null);
  const currency = settings?.currency || 'OMR';
  const reminderDays = settings?.reminder_days ?? 7;

  const alerts = useMemo(() => {
    return data.orders
      .filter((o) => o.status !== 'delivered' && o.delivery_date)
      .filter((o) => {
        const d = daysUntil(o.delivery_date!);
        return d <= reminderDays;
      })
      .sort((a, b) => daysUntil(a.delivery_date!) - daysUntil(b.delivery_date!));
  }, [data.orders, reminderDays]);

  const red = alerts.filter((o) => o.status === 'pending' || o.status === 'cutting');
  const blue = alerts.filter((o) => o.status === 'stitching');
  const green = alerts.filter((o) => o.status === 'ready');

  return (
    <div className="space-y-6 animate-fade">
      <div>
        <h2 className="text-xl font-bold">Delivery Alerts</h2>
        <p className="text-sm text-slate-500">Orders due within {reminderDays} days</p>
      </div>

      {alerts.length === 0 ? (
        <Card><EmptyState icon={<Bell />} title="No alerts" subtitle="All orders are on track" /></Card>
      ) : (
        <>
          {/* RED */}
          {red.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <h3 className="font-bold text-rose-600 dark:text-rose-400">Pending ({red.length})</h3>
              </div>
              <div className="space-y-2">
                {red.map((o) => <AlertCard key={o.id} order={o} currency={currency} onClick={() => setSelected(o)} />)}
              </div>
            </section>
          )}

          {/* BLUE */}
          {blue.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <h3 className="font-bold text-blue-600 dark:text-blue-400">Stitching ({blue.length})</h3>
              </div>
              <div className="space-y-2">
                {blue.map((o) => <AlertCard key={o.id} order={o} currency={currency} onClick={() => setSelected(o)} />)}
              </div>
            </section>
          )}

          {/* GREEN */}
          {green.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-emerald-600 dark:text-emerald-400">Ready ({green.length})</h3>
              </div>
              <div className="space-y-2">
                {green.map((o) => <AlertCard key={o.id} order={o} currency={currency} onClick={() => setSelected(o)} />)}
              </div>
            </section>
          )}
        </>
      )}

      {selected && (
        <OrderDetail
          order={selected}
          workers={data.workers}
          salesmen={data.salesmen}
          settings={settings}
          onClose={() => setSelected(null)}
          onEdit={() => { setSelected(null); navigate('/orders'); }}
          onDeleted={() => { setSelected(null); data.refresh(); }}
        />
      )}
    </div>
  );
}

function AlertCard({ order, currency, onClick }: { order: Order; currency: string; onClick: () => void }) {
  const d = daysUntil(order.delivery_date!);
  return (
    <button onClick={onClick} className="card p-4 w-full text-left hover:shadow-md transition flex items-center gap-3">
      <div className={`w-1.5 h-12 rounded-full ${
        order.status === 'ready' ? 'bg-emerald-500' : order.status === 'stitching' ? 'bg-blue-500' : 'bg-rose-500'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm truncate">{order.customer_name}</p>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-xs text-slate-500">#{order.receipt_number} · {fmtMoney(order.balance, currency)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-slate-500">Due</p>
        <p className={`text-sm font-bold ${d < 0 ? 'text-rose-500' : d <= 2 ? 'text-amber-500' : ''}`}>
          {fmtDate(order.delivery_date)}
        </p>
        <p className="text-xs text-slate-400">{d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}</p>
      </div>
    </button>
  );
}
