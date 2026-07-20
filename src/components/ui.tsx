import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, useEffect } from 'react';
import { X } from 'lucide-react';
import type { PaymentAccount, Shop } from '../lib/types';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const cls = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-ghost';
  return <button className={`${cls} ${className}`} {...props}>{children}</button>;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select className={`input ${className}`} {...props}>{children}</select>;
}

export function PaymentAccountSelect({ shops, accounts, value, onChange, className = '', placeholder = 'Select payment account' }: {
  shops: Shop[]; accounts: PaymentAccount[]; value: string; onChange: (id: string) => void; className?: string; placeholder?: string;
}) {
  return (
    <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {shops.map((shop) => {
        const shopAccounts = accounts.filter((a) => a.shop_id === shop.id);
        if (shopAccounts.length === 0) return null;
        return (
          <optgroup key={shop.id} label={shop.name}>
            {shopAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.type !== 'cash' ? ` (${a.type.toUpperCase()})` : ''}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="label">{children}</label>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Badge({ children, color = 'slate', className = '' }: { children: ReactNode; color?: 'slate' | 'red' | 'blue' | 'green' | 'amber' | 'sky' | 'rose' | 'emerald'; className?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  };
  return <span className={`chip ${map[color] || map.slate} ${className}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const w = { sm: 'sm:max-w-[24rem]', md: 'sm:max-w-[36rem]', lg: 'sm:max-w-[46rem]', xl: 'sm:max-w-[64rem]' }[size];
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full items-end justify-center p-0 sm:items-center sm:p-3">
        {/*
          The overlay above is `fixed inset-0`, so it is always pinned exactly to
          the viewport edges — meaning `h-full` here always equals the real,
          current viewport height, with no dependency on vh/dvh units (which can
          be unreliable depending on browser/bundler support). The card below
          uses `max-h-full`, which is a percentage of this same reliable box, so
          it can never grow taller than the visible screen. Header and footer are
          flex-shrink-0 (always visible, never scroll away), and only the middle
          body scrolls.
        */}
        <div
          className={`relative flex max-h-full w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100%-1.5rem)] sm:rounded-2xl ${w}`}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex-shrink-0 flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>

          {/* Header: fixed, never scrolls */}
          <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white sm:text-lg">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 active:scale-90 dark:hover:bg-slate-800">
              <X size={20} />
            </button>
          </div>

          {/* Body: the only scrollable region */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">{children}</div>

          {/* Footer: fixed, never scrolls, always visible on every screen size */}
          {footer && (
            <div
              className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">{icon}</div>
      <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <div className={`w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />;
}

export function StatCard({ label, value, icon, accent = 'sky', onClick }: { label: string; value: ReactNode; icon: ReactNode; accent?: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    sky: 'from-sky-500/10 to-sky-500/5 text-sky-600 dark:text-sky-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    rose: 'from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400',
    amber: 'from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400',
    violet: 'from-violet-500/10 to-violet-500/5 text-violet-600 dark:text-violet-400',
    slate: 'from-slate-500/10 to-slate-500/5 text-slate-600 dark:text-slate-400',
    blue: 'from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400',
    green: 'from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
  };
  return (
    <div
      onClick={onClick}
      className={`card p-4 bg-gradient-to-br ${colors[accent]} ${onClick ? 'cursor-pointer hover:shadow-md transition' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-800/60">{icon}</div>
      </div>
    </div>
  );
}