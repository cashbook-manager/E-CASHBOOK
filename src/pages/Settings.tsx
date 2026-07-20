import { useEffect, useState } from 'react';
import { Save, Store, Palette, Database, Download, Upload, Trash2, Bell, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Settings as SettingsType } from '../lib/types';
import { Card, Button, Input, Field, Select, Spinner } from '../components/ui';
import { updateSettings, useSettings, useDarkMode } from '../lib/store';
import { exportCSV } from '../lib/format';

export function Settings() {
  const settings = useSettings();
  const { dark, toggle } = useDarkMode();
  const [form, setForm] = useState<Partial<SettingsType>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  async function uploadLogo(file: File, field: 'logo' | 'profile_photo') {
    const path = `settings/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('receipts').getPublicUrl(path);
      setForm((f) => ({ ...f, [field]: data.publicUrl }));
    }
  }

  async function save() {
    setSaving(true);
    await updateSettings(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function exportData() {
    const tables = ['orders', 'workers', 'salesmen', 'worker_payments', 'worker_final_payments', 'salesman_salary_ledger', 'cashbook', 'worker_designs', 'order_workers', 'order_timeline'];
    const rows: (string | number)[][] = [['Table', 'Data']];
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*');
      if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        rows.push([t]);
        rows.push(keys as (string | number)[]);
        data.forEach((row) => rows.push(keys.map((k) => (row as any)[k] ?? '')));
        rows.push([]);
      }
    }
    exportCSV('backup.csv', rows);
  }

  async function resetDB() {
    if (!confirm('This will DELETE ALL data. Are you absolutely sure?')) return;
    if (!confirm('Last warning: all orders, workers, payments, and cashbook entries will be permanently deleted. Continue?')) return;
    const tables = ['order_timeline', 'order_workers', 'worker_payments', 'worker_final_payments', 'worker_designs', 'salesman_salary_ledger', 'cashbook', 'orders', 'workers', 'salesmen'];
    for (const t of tables) {
      await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    alert('Database reset complete.');
    window.location.reload();
  }

  if (!settings) return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;

  return (
    <div className="space-y-4 animate-fade max-w-3xl mx-auto">
      <h2 className="text-xl font-bold">Settings</h2>

      {/* Shop Info */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Store size={20} className="text-sky-600" />
          <h3 className="font-bold">Shop Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Shop Name"><Input value={form.shop_name || ''} onChange={(e) => setForm((f) => ({ ...f, shop_name: e.target.value }))} /></Field>
          <Field label="Owner Name"><Input value={form.owner_name || ''} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="WhatsApp"><Input value={form.whatsapp || ''} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></Field>
          <div className="md:col-span-2"><Field label="Address"><Input value={form.address || ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field></div>
          <Field label="Currency">
            <Select value={form.currency || 'OMR'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
              <option value="OMR">OMR (Omani Rial)</option>
              <option value="AED">AED (UAE Dirham)</option>
              <option value="SAR">SAR (Saudi Riyal)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="GBP">GBP (Pound)</option>
              <option value="INR">INR (Indian Rupee)</option>
              <option value="PKR">PKR (Pakistani Rupee)</option>
            </Select>
          </Field>
          <Field label="Reminder Days"><Input type="number" value={form.reminder_days ?? 7} onChange={(e) => setForm((f) => ({ ...f, reminder_days: Number(e.target.value) }))} /></Field>
          <Field label="Opening Cash"><Input type="number" step="0.001" value={form.opening_cash ?? 0} onChange={(e) => setForm((f) => ({ ...f, opening_cash: Number(e.target.value) }))} /><p className="text-xs text-slate-500 mt-1">Starting cash in the drawer</p></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Shop Logo">
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0], 'logo')} className="text-sm" />
            {form.logo && <img src={form.logo} alt="" className="w-16 h-16 rounded-lg object-cover mt-2" />}
          </Field>
          <Field label="Profile Photo">
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0], 'profile_photo')} className="text-sm" />
            {form.profile_photo && <img src={form.profile_photo} alt="" className="w-16 h-16 rounded-full object-cover mt-2" />}
          </Field>
        </div>
      </Card>

      {/* Theme */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={20} className="text-sky-600" />
          <h3 className="font-bold">Appearance</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Dark Mode</p>
            <p className="text-xs text-slate-500">Toggle between light and dark theme</p>
          </div>
          <button
            onClick={toggle}
            className={`w-12 h-7 rounded-full transition relative ${dark ? 'bg-sky-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition ${dark ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={20} className="text-sky-600" />
          <h3 className="font-bold">Notifications</h3>
        </div>
        <Field label="Delivery Reminder Days">
          <Input type="number" value={form.reminder_days ?? 7} onChange={(e) => setForm((f) => ({ ...f, reminder_days: Number(e.target.value) }))} />
          <p className="text-xs text-slate-500 mt-1">Orders due within this many days will appear in alerts</p>
        </Field>
      </Card>

      {/* Data Management */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-sky-600" />
          <h3 className="font-bold">Data Management</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={exportData}><Download size={16} /> Export Data (CSV)</Button>
          <Button variant="ghost" onClick={() => alert('Import feature: use the exported CSV to restore data manually.')}><Upload size={16} /> Import Data</Button>
          <Button variant="danger" onClick={resetDB}><Trash2 size={16} /> Reset Database</Button>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={20} className="text-sky-600" />
          <h3 className="font-bold">Admin Security</h3>
        </div>
        <Field label="Admin Password">
          <Input
            type={showPw ? 'text' : 'password'}
            value={form.admin_password || ''}
            onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))}
            placeholder="Admin dashboard password"
          />
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="showPw" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="rounded" />
            <label htmlFor="showPw" className="text-xs text-slate-500">Show password</label>
          </div>
          <p className="text-xs text-slate-500 mt-1">This password protects all admin pages (Dashboard, Reports, Workers, Settings, etc.). Salesmen access the app without a password.</p>
        </Field>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3 sticky bottom-4">
        <Button onClick={save} disabled={saving} className="flex-1">
          <Save size={18} /> {saving ? 'Saving…' : 'Save Settings'}
        </Button>
        {saved && <span className="text-sm text-emerald-600 font-semibold animate-fade">Saved!</span>}
      </div>
    </div>
  );
}
