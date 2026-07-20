import { useState } from 'react';
import { Layout } from './components/Layout';
import { useRoute, isAdminRoute } from './lib/router';
import { useAdminAuth } from './lib/auth';
import { AdminPasswordGate } from './components/AdminPasswordGate';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Alerts } from './pages/Alerts';
import { Workers, WorkerProfile } from './pages/Workers';
import { Salesmen, SalesmanProfile } from './pages/Salesmen';
import { Cashbook } from './pages/Cashbook';
import { Reports } from './pages/Reports';
import { PaymentAccounts } from './pages/PaymentAccounts';
import { Settings } from './pages/Settings';
import { ShareView } from './pages/ShareView';

export default function App() {
  const route = useRoute();
  const { authorized } = useAdminAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // Share view is a standalone page (no app shell) — the only public, unauthenticated
  // page left, and it only ever shows the one salesman's own orders for a valid token.
  if (route.name === 'share') {
    return <ShareView token={route.token} />;
  }

  // All other routes are admin-only — show password gate if not authorized
  if (isAdminRoute(route.name) && !authorized) {
    const currentHash = window.location.hash.slice(1) || '/';
    return <AdminPasswordGate redirectTo={currentHash} />;
  }

  return (
    <Layout onSearch={setSearchQuery}>
      {route.name === 'dashboard' && <Dashboard searchQuery={searchQuery} />}
      {route.name === 'orders' && <Orders />}
      {route.name === 'alerts' && <Alerts />}
      {route.name === 'workers' && <Workers />}
      {route.name === 'worker' && <WorkerProfile id={route.id} />}
      {route.name === 'salesmen' && <Salesmen />}
      {route.name === 'salesman' && <SalesmanProfile id={route.id} />}
      {route.name === 'cashbook' && <Cashbook />}
      {route.name === 'reports' && <Reports />}
      {route.name === 'payment-accounts' && <PaymentAccounts />}
      {route.name === 'settings' && <Settings />}
    </Layout>
  );
}
