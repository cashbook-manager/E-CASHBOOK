import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
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
  const closedByBackButton = useRef(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';

    // Push a history entry so the device/browser back button closes this
    // page instead of leaving the app — this is what makes it feel and
    // behave like navigating to a real "next page" rather than a popup.
    window.history.pushState({ formPage: true }, '');
    const popHandler = () => { closedByBackButton.current = true; onClose(); };
    window.addEventListener('popstate', popHandler);

    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('popstate', popHandler);
      document.body.style.overflow = '';
      // Closing any other way (Save, Cancel, the back arrow) should also
      // clean up the history entry we pushed, so a later back-button press
      // doesn't just reopen this form.
      if (!closedByBackButton.current) {
        window.history.back();
      }
      closedByBackButton.current = false;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Content column width on larger screens — keeps long forms readable
  // instead of stretching edge-to-edge, while the header/footer bars still
  // span the full page width like a real page would.
  const maxW = { sm: 'sm:max-w-[28rem]', md: 'sm:max-w-[40rem]', lg: 'sm:max-w-[50rem]', xl: 'sm:max-w-[68rem]' }[size];
  return (
    <div className="animate-slide-in-right fixed inset-0 z-[60] flex flex-col bg-white dark:bg-slate-900">
      {/* Header: fixed page top bar, never scrolls */}
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4">
        <button onClick={onClose} className="-ml-1 rounded-full p-2 text-slate-600 transition hover:bg-slate-100 active:scale-90 dark:text-slate-300 dark:hover:bg-slate-800">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">{title}</h3>
      </div>

      {/* Body: the only scrollable region. overflow-y-scroll (not auto) plus
          the inline WebkitOverflowScrolling/touchAction guarantee real,
          smooth scrolling on every device, not just ones where the browser
          happens to infer it. */}
      <div
        className="flex-1 min-h-0 overflow-y-scroll overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        <div className={`mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 ${maxW}`}>{children}</div>
      </div>

      {/* Footer: fixed at the bottom of the page, always visible, never scrolls */}
      {footer && (
        <div
          className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-4"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className={`mx-auto w-full ${maxW}`}>{footer}</div>
        </div>
      )}
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
