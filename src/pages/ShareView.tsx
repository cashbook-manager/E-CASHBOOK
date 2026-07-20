import { useEffect, useState } from 'react';
import { Scissors, Search, MessageCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Salesman, Order, OrderWorker, Worker, Settings } from '../lib/types';
import { Card, Badge, Spinner, EmptyState, Modal } from '../components/ui';
import { fmtMoney, fmtDate } from '../lib/format';
import { DigitalReceipt } from '../components/DigitalReceipt';

export function ShareView({ token }: { token: string }) {
  const [salesman, setSalesman] = useState<Salesman | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignments, setAssignments] = useState<Record<string, OrderWorker[]>>({});
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('salesmen').select('*').eq('share_token', token).maybeSingle().then((r) => r.data as Salesman | null),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle().then((r) => r.data as Settings | null),
      supabase.from('workers').select('*').then((r) => r.data as Worker[] || []),
    ]).then(([s, st, w]) => {
      setSalesman(s);
      setSettings(st);
      setWorkers(w);
      if (s) {
        supabase.from('orders').select('*').eq('salesman_id', s.id).order('created_at', { ascending: false }).then(({ data }) => {
          const os = (data as Order[]) || [];
          setOrders(os);
          if (os.length > 0) {
            supabase.from('order_workers').select('*').in('order_id', os.map((o) => o.id)).then(({ data: ows }) => {
              const map: Record<string, OrderWorker[]> = {};
              (ows as OrderWorker[] || []).forEach((a) => {
                (map[a.order_id] = map[a.order_id] || []).push(a);
              });
              setAssignments(map);
            });
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, [token]);

  const filtered = orders.filter((o) =>
    o.customer_name.toLowerCase().includes(q.toLowerCase()) ||
    o.receipt_number.toLowerCase().includes(q.toLowerCase()) ||
    o.whatsapp_number.includes(q)
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;
  if (!salesman) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="p-8 text-center max-w-sm">
        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Invalid Link</p>
        <p className="text-sm text-slate-500 mt-1">This share link is no longer valid.</p>
      </Card>
    </div>
  );

  const currency = settings?.currency || 'OMR';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white">
            <Scissors size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{settings?.shop_name || 'Tailor Shop'}</p>
            <p className="text-xs text-slate-500">Salesman: {salesman.name}</p>
          </div>
          <Badge color="slate"><Eye size={12} /> Read Only</Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your orders…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm outline-none focus:border-sky-500"
          />
        </div>

        {filtered.length === 0 ? (
          <Card><EmptyState icon={<Search />} title="No orders found" /></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((o) => {
              const ows = assignments[o.id] || [];
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {o.receipt_image ? (
                      <img src={o.receipt_image} alt="" className="w-14 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Scissors size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm">{o.customer_name}</p>
                        <Badge color={o.status === 'delivered' ? 'slate' : o.status === 'ready' ? 'green' : o.status === 'stitching' ? 'blue' : o.status === 'cutting' ? 'amber' : 'rose'}>
                          {o.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">#{o.receipt_number} · Due {fmtDate(o.delivery_date)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-sm">{fmtMoney(o.balance, currency)}</span>
                        <button onClick={() => window.open(`https://wa.me/${o.whatsapp_number.replace(/[^0-9]/g, '')}`)}
                          className="text-green-600 p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
                          <MessageCircle size={16} />
                        </button>
                      </div>
                      {/* Worker progress */}
                      {ows.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ows.map((a) => {
                            const w = workers.find((x) => x.id === a.worker_id);
                            return (
                              <span key={a.id} className={`text-xs px-2 py-0.5 rounded-full ${a.submitted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                {w?.name || 'Worker'} ({a.category})
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSelected(o)} className="w-full mt-3 py-1.5 text-sm font-semibold text-sky-600 hover:underline">
                    View Receipt
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {selected && (
        <Modal open={true} onClose={() => setSelected(null)} title={`Receipt #${selected.receipt_number}`} size="sm">
          <DigitalReceipt order={selected} settings={settings} />
        </Modal>
      )}
    </div>
  );
}
