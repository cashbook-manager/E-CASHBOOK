import { useState } from 'react';
import { Lock, Eye, EyeOff, Scissors, ArrowRight, ShieldAlert } from 'lucide-react';
import { verifyPassword, useAdminAuth } from '../lib/auth';
import { useSettings } from '../lib/store';
import { navigate } from '../lib/router';
import { Spinner } from './ui';

export function AdminPasswordGate({ redirectTo }: { redirectTo: string }) {
  const settings = useSettings();
  const { login } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { authorized, error: err } = await verifyPassword(password);
    setLoading(false);
    if (authorized) {
      login();
      navigate(redirectTo);
    } else {
      setError(err || 'Incorrect password');
      setPassword('');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center text-white shadow-lg shadow-sky-600/30 mb-3">
            <Scissors size={28} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{settings?.shop_name || 'Tailor Shop'}</h1>
          <p className="text-sm text-slate-500">Admin Dashboard</p>
        </div>

        {/* Password card */}
        <div className="card p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
              <Lock size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Authentication Required</h2>
              <p className="text-xs text-slate-500">Enter the admin password to continue</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                autoFocus
                className="input pr-11"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm animate-fade">
                <ShieldAlert size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <Spinner /> : <>Unlock Dashboard <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Protected area. Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
