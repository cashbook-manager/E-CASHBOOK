import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, Bell, Users, UserSquare2, BookOpen, FileBarChart, Settings as SettingsIcon,
  Menu, X, Moon, Sun, Calendar, Search, ChevronLeft, ChevronRight, Scissors, LogOut, Wallet, Store,
} from 'lucide-react';
import { useRoute, navigate } from '../lib/router';
import { useSettings, useDarkMode, useSelectedBranch } from '../lib/store';
import { useAdminAuth } from '../lib/auth';
import { fmtDate, todayISO, daysUntil } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Order, Shop } from '../lib/types';

const NAV = [
  { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'orders', label: 'Orders', icon: ShoppingBag, path: '/orders' },
  { name: 'alerts', label: 'Alerts', icon: Bell, path: '/alerts' },
  { name: 'workers', label: 'Workers', icon: Users, path: '/workers' },
  { name: 'salesmen', label: 'Salesmen', icon: UserSquare2, path: '/salesmen' },
  { name: 'cashbook', label: 'Cashbook', icon: BookOpen, path: '/cashbook' },
  { name: 'reports', label: 'Reports', icon: FileBarChart, path: '/reports' },
  { name: 'payment-accounts', label: 'Payment Accounts', icon: Wallet, path: '/payment-accounts' },
  { name: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
] as const;

export function Layout({ children, onSearch }: { children: React.ReactNode; onSearch?: (q: string) => void }) {
  const route = useRoute();
  const settings = useSettings();
  const { dark, toggle } = useDarkMode();
  const { logout } = useAdminAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const { branch, setBranch } = useSelectedBranch();

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .neq('status', 'delivered')
      .then(({ data }) => data && setOrders(data as Order[]));
  }, [route]);

  useEffect(() => {
    supabase.from('shops').select('*').eq('status', 'active').order('created_at')
      .then(({ data }) => setShops((data as Shop[]) || []));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => onSearch?.(searchQ), 250);
    return () => clearTimeout(t);
  }, [searchQ, onSearch]);

  const alerts = useMemo(() => {
    const days = settings?.reminder_days ?? 7;
    return orders.filter((o) => o.delivery_date && daysUntil(o.delivery_date) <= days && daysUntil(o.delivery_date) >= -100);
  }, [orders, settings]);

  const notifColor = (o: Order) => {
    if (o.status === 'ready') return 'bg-emerald-500';
    if (o.status === 'stitching') return 'bg-blue-500';
    return 'bg-rose-500';
  };

  const activeName = route.name === 'worker' ? 'workers' : route.name === 'salesman' ? 'salesmen' : route.name;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 lg:shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white shadow-lg shadow-sky-600/30">
            <Scissors size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{settings?.shop_name || 'Tailor Shop'}</p>
            <p className="text-xs text-slate-500 truncate">ERP System</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-500" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activeName === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={19} />
                {item.label}
                {item.name === 'alerts' && alerts.length > 0 && (
                  <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{alerts.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {settings?.profile_photo ? (
              <img src={settings.profile_photo} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-sm">
                {(settings?.owner_name || 'A').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{settings?.owner_name || 'Admin'}</p>
              <p className="text-xs text-slate-500">Administrator</p>
            </div>
            <button
              onClick={() => { logout(); navigate('/dashboard'); }}
              className="ml-auto p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
              title="Admin Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <button className="lg:hidden text-slate-600 dark:text-slate-300" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>

            {/* Branch switcher */}
            {shops.length > 0 && (
              <div className="relative flex items-center gap-1.5 sm:gap-2 pl-1 pr-1.5 sm:pr-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900">
                <Store size={16} className="text-sky-600 flex-shrink-0" />
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="bg-transparent text-sm font-semibold outline-none max-w-[6rem] sm:max-w-[9rem] truncate cursor-pointer"
                  title="Filter the whole app by branch"
                >
                  <option value="all">All Branches</option>
                  {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Universal search */}
            <div className="flex-1 max-w-xl relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search receipts, customers, workers, amounts…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm outline-none transition"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {/* Calendar */}
              <div className="relative">
                <button
                  onClick={() => setCalOpen((v) => !v)}
                  className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hidden sm:flex items-center gap-2"
                >
                  <Calendar size={18} />
                  <span className="text-sm font-medium hidden md:inline">{fmtDate(todayISO())}</span>
                </button>
                {calOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setCalOpen(false)} />
                    <CalendarPicker onClose={() => setCalOpen(false)} />
                  </>
                )}
              </div>

              {/* Dark mode */}
              <button onClick={toggle} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <Bell size={18} />
                  {alerts.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {alerts.length}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] card shadow-xl z-40 animate-fade">
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                        <p className="font-bold text-sm">Notifications</p>
                        <p className="text-xs text-slate-500">{alerts.length} orders due soon</p>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {alerts.length === 0 && <p className="p-4 text-sm text-slate-500 text-center">No alerts</p>}
                        {alerts.slice(0, 20).map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              navigate(`/orders`);
                              setNotifOpen(false);
                            }}
                            className="w-full flex items-start gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full ${notifColor(o)} flex-shrink-0`} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{o.customer_name}</p>
                              <p className="text-xs text-slate-500">#{o.receipt_number} · Due {fmtDate(o.delivery_date)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}

function CalendarPicker({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(new Date());
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  return (
    <div className="absolute right-0 mt-2 w-72 card shadow-xl z-40 animate-fade p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setDate(new Date(y, m - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronLeft size={18} />
        </button>
        <p className="font-bold text-sm">{date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <button onClick={() => setDate(new Date(y, m + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {cells.map((d, i) => {
          const today = d === new Date().getDate() && m === new Date().getMonth() && y === new Date().getFullYear();
          return (
            <span
              key={i}
              className={`py-1.5 rounded-lg ${d ? 'hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer' : ''} ${today ? 'bg-sky-600 text-white font-bold' : ''}`}
              onClick={onClose}
            >
              {d || ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
