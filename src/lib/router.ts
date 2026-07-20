import { useEffect, useState } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'orders' }
  | { name: 'alerts' }
  | { name: 'workers' }
  | { name: 'worker'; id: string }
  | { name: 'salesmen' }
  | { name: 'salesman'; id: string }
  | { name: 'cashbook' }
  | { name: 'reports' }
  | { name: 'payment-accounts' }
  | { name: 'settings' }
  | { name: 'share'; token: string };

const ADMIN_ROUTES = new Set(['dashboard', 'orders', 'alerts', 'workers', 'worker', 'salesmen', 'salesman', 'cashbook', 'reports', 'payment-accounts', 'settings']);

export function isAdminRoute(name: string): boolean {
  return ADMIN_ROUTES.has(name);
}

export function parseHash(): Route {
  const h = window.location.hash.slice(1) || '/';
  const parts = h.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'dashboard') return { name: 'dashboard' };
  if (parts[0] === 'orders') return { name: 'orders' };
  if (parts[0] === 'alerts') return { name: 'alerts' };
  if (parts[0] === 'workers') return { name: 'workers' };
  if (parts[0] === 'worker' && parts[1]) return { name: 'worker', id: parts[1] };
  if (parts[0] === 'salesmen') return { name: 'salesmen' };
  if (parts[0] === 'salesman' && parts[1]) return { name: 'salesman', id: parts[1] };
  if (parts[0] === 'cashbook') return { name: 'cashbook' };
  if (parts[0] === 'reports') return { name: 'reports' };
  if (parts[0] === 'payment-accounts') return { name: 'payment-accounts' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'share' && parts[1]) return { name: 'share', token: parts[1] };
  return { name: 'dashboard' };
}

export function navigate(route: string) {
  window.location.hash = route;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash());
  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}
