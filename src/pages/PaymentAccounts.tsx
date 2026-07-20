import { useEffect, useMemo, useState } from 'react';
import { Plus, Wallet, Landmark, CreditCard, Store, Pencil, Trash2, Ban, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PaymentAccount, PaymentAccountType, Shop } from '../lib/types';
import { Card, Button, Input, Select, Field, Modal, EmptyState, Spinner, Badge } from '../components/ui';

export function PaymentAccounts() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<{ type: PaymentAccountType; editing: PaymentAccount | null } | null>(null);

  function refresh() {
    setLoading(true);
    Promise.all([
      supabase.from('shops').select('*').order('created_at'),
      supabase.from('payment_accounts').select('*').order('created_at'),
    ]).then(([shopsRes, accountsRes]) => {
      setShops((shopsRes.data as Shop[]) || []);
      setAccounts((accountsRes.data as PaymentAccount[]) || []);
      setLoading(false);
    });
  }

  useEffect(() => { refresh(); }, []);

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name || '—';

  const cashAccounts = useMemo(() => accounts.filter((a) => a.type === 'cash'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'bank'), [accounts]);
  const posAccounts = useMemo(() => accounts.filter((a) => a.type === 'pos'), [accounts]);

  async function toggleStatus(a: PaymentAccount) {
    const status = a.status === 'available' ? 'disabled' : 'available';
    await supabase.from('payment_accounts').update({ status }).eq('id', a.id);
    refresh();
  }

  async function deleteAccount(a: PaymentAccount) {
    if (!confirm(`Remove "${a.name}"?`)) return;
    await supabase.from('payment_accounts').delete().eq('id', a.id);
    refresh();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-sky-600" /></div>;

  return (
    <div className="space-y-6 animate-fade">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Payment Accounts</h2>
          <p className="text-sm text-slate-500">Manage every cash drawer, bank account, and POS machine across all branches.</p>
        </div>
        <Button variant="ghost" onClick={() => setShopFormOpen(true)}><Store size={16} /> Manage Branches</Button>
      </div>

      {shops.length === 0 && (
        <Card className="p-4">
          <EmptyState icon={<Store />} title="No branches yet" subtitle="Add a branch first, then attach cash, bank, and POS accounts to it." />
          <div className="flex justify-center mt-2">
            <Button onClick={() => setShopFormOpen(true)}><Plus size={16} /> Add Branch</Button>
          </div>
        </Card>
      )}

      {/* A) Cash Management */}
      <AccountSection
        title="Cash Management"
        icon={<Wallet size={18} />}
        addLabel="Add Cash"
        onAdd={() => setAccountForm({ type: 'cash', editing: null })}
        disabled={shops.length === 0}
      >
        {cashAccounts.length === 0 ? (
          <EmptyState icon={<Wallet />} title="No cash accounts" subtitle="Add a cash drawer for each branch." />
        ) : (
          <Table
            columns={['Name', 'Branch', 'Status', '']}
            rows={cashAccounts.map((a) => [
              a.name,
              shopName(a.shop_id),
              <StatusBadge status={a.status} />,
              <RowActions account={a} onEdit={() => setAccountForm({ type: 'cash', editing: a })} onToggle={() => toggleStatus(a)} onDelete={() => deleteAccount(a)} />,
            ])}
          />
        )}
      </AccountSection>

      {/* B) Bank Accounts */}
      <AccountSection
        title="Bank Accounts"
        icon={<Landmark size={18} />}
        addLabel="Add Bank Account"
        onAdd={() => setAccountForm({ type: 'bank', editing: null })}
        disabled={shops.length === 0}
      >
        {bankAccounts.length === 0 ? (
          <EmptyState icon={<Landmark />} title="No bank accounts" subtitle="Add the bank accounts used to receive or pay money." />
        ) : (
          <Table
            columns={['Bank', 'Account', 'Branch', 'Status', '']}
            rows={bankAccounts.map((a) => [
              a.bank_name || '—',
              a.name,
              shopName(a.shop_id),
              <StatusBadge status={a.status} />,
              <RowActions account={a} onEdit={() => setAccountForm({ type: 'bank', editing: a })} onToggle={() => toggleStatus(a)} onDelete={() => deleteAccount(a)} />,
            ])}
          />
        )}
      </AccountSection>

      {/* C) POS Machines */}
      <AccountSection
        title="POS Machines"
        icon={<CreditCard size={18} />}
        addLabel="Add POS Machine"
        onAdd={() => setAccountForm({ type: 'pos', editing: null })}
        disabled={shops.length === 0}
      >
        {posAccounts.length === 0 ? (
          <EmptyState icon={<CreditCard />} title="No POS machines" subtitle="Add the card machines used at each branch." />
        ) : (
          <Table
            columns={['POS Name', 'Bank', 'Branch', 'Status', '']}
            rows={posAccounts.map((a) => [
              a.name,
              a.bank_name || '—',
              shopName(a.shop_id),
              <StatusBadge status={a.status} />,
              <RowActions account={a} onEdit={() => setAccountForm({ type: 'pos', editing: a })} onToggle={() => toggleStatus(a)} onDelete={() => deleteAccount(a)} />,
            ])}
          />
        )}
      </AccountSection>

      {shopFormOpen && <ShopManager shops={shops} onClose={() => setShopFormOpen(false)} onChanged={refresh} />}
      {accountForm && (
        <AccountFormModal
          type={accountForm.type}
          editing={accountForm.editing}
          shops={shops}
          onClose={() => setAccountForm(null)}
          onSaved={() => { setAccountForm(null); refresh(); }}
        />
      )}
    </div>
  );
}

function AccountSection({ title, icon, addLabel, onAdd, disabled, children }: {
  title: string; icon: React.ReactNode; addLabel: string; onAdd: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span className="text-sky-600">{icon}</span> {title}
        </div>
        <Button onClick={onAdd} disabled={disabled} className="text-sm"><Plus size={16} /> {addLabel}</Button>
      </div>
      {children}
    </Card>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200 dark:border-slate-800">
            {columns.map((c, i) => <th key={i} className="py-2 px-4 sm:px-2 font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              {r.map((cell, j) => <td key={j} className="py-2.5 px-4 sm:px-2">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === 'available' ? <Badge color="green">Available ✅</Badge> : <Badge color="red">Disabled</Badge>;
}

function RowActions({ account, onEdit, onToggle, onDelete }: { account: PaymentAccount; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onEdit} className="text-sky-600 hover:text-sky-500"><Pencil size={15} /></button>
      <button onClick={onToggle} title={account.status === 'available' ? 'Disable' : 'Enable'} className="text-amber-600 hover:text-amber-500">
        {account.status === 'available' ? <Ban size={15} /> : <CheckCircle2 size={15} />}
      </button>
      <button onClick={onDelete} className="text-rose-500 hover:text-rose-400"><Trash2 size={15} /></button>
    </div>
  );
}

function AccountFormModal({ type, editing, shops, onClose, onSaved }: {
  type: PaymentAccountType; editing: PaymentAccount | null; shops: Shop[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<PaymentAccount>>(editing || {
    type, name: '', bank_name: '', account_number: '', pos_machine_id: '',
    shop_id: shops[0]?.id || '', status: 'available',
  });
  const [saving, setSaving] = useState(false);

  const titleLabel = type === 'cash' ? 'Cash Account' : type === 'bank' ? 'Bank Account' : 'POS Machine';

  async function save() {
    if (!form.shop_id || !form.name) return;
    setSaving(true);
    const payload = {
      type,
      shop_id: form.shop_id,
      name: form.name,
      bank_name: form.bank_name || '',
      account_number: form.account_number || '',
      pos_machine_id: form.pos_machine_id || '',
      status: form.status || 'available',
    };
    if (editing) {
      await supabase.from('payment_accounts').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('payment_accounts').insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      open onClose={onClose} title={editing ? `Edit ${titleLabel}` : `Add ${titleLabel}`}
      footer={
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.shop_id || !form.name}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Branch">
          <Select value={form.shop_id || ''} onChange={(e) => setForm((f) => ({ ...f, shop_id: e.target.value }))}>
            <option value="" disabled>Select branch</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>

        <Field label={type === 'pos' ? 'POS Name' : type === 'bank' ? 'Account Name' : 'Name'}>
          <Input
            value={form.name || ''}
            placeholder={type === 'cash' ? 'Shop 1 Cash' : type === 'bank' ? 'Shop 1 Main Account' : 'Shop 1 POS Machine'}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>

        {(type === 'bank' || type === 'pos') && (
          <Field label="Bank Name">
            <Input value={form.bank_name || ''} placeholder="Bank Muscat" onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
          </Field>
        )}

        {type === 'bank' && (
          <Field label="Account Number">
            <Input value={form.account_number || ''} placeholder="XXXXXX" onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
          </Field>
        )}

        {type === 'pos' && (
          <Field label="Machine ID">
            <Input value={form.pos_machine_id || ''} placeholder="POS-001" onChange={(e) => setForm((f) => ({ ...f, pos_machine_id: e.target.value }))} />
          </Field>
        )}

        <Field label="Status">
          <Select value={form.status || 'available'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'available' | 'disabled' }))}>
            <option value="available">Available</option>
            <option value="disabled">Disabled</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ShopManager({ shops, onClose, onChanged }: { shops: Shop[]; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function addShop() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('shops').insert({ name: name.trim(), address, phone, status: 'active' });
    setName(''); setAddress(''); setPhone('');
    setSaving(false);
    onChanged();
  }

  async function toggleShop(s: Shop) {
    await supabase.from('shops').update({ status: s.status === 'active' ? 'disabled' : 'active' }).eq('id', s.id);
    onChanged();
  }

  return (
    <Modal
      open onClose={onClose} title="Branches"
      footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Branch Name"><Input value={name} placeholder="Shop 2" onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
        <Button onClick={addShop} disabled={saving || !name.trim()}><Plus size={16} /> Add Branch</Button>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {shops.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{s.name}</p>
                {s.address && <p className="text-xs text-slate-500 truncate">{s.address}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={s.status === 'active' ? 'available' : 'disabled'} />
                <button onClick={() => toggleShop(s)} className="text-amber-600 hover:text-amber-500" title={s.status === 'active' ? 'Disable' : 'Enable'}>
                  {s.status === 'active' ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
