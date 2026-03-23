import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'investment', label: 'Investment' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const TYPE_ICONS = {
  checking: { icon: '🏦', color: '#3B82F6' },
  savings: { icon: '🏧', color: '#10B981' },
  credit_card: { icon: '💳', color: '#F59E0B' },
  loan: { icon: '📋', color: '#EF4444' },
  investment: { icon: '📈', color: '#8B5CF6' },
  cash: { icon: '💵', color: '#22C55E' },
  other: { icon: '🏛️', color: '#6B7280' },
};

function AccountCard({ acc, onEdit, onDelete }) {
  const meta = TYPE_ICONS[acc.type] || TYPE_ICONS.other;
  const isLiability = ['credit_card', 'loan'].includes(acc.type);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: meta.color + '18' }}>
              {meta.icon}
            </div>
            <div>
              <p className="font-semibold">{acc.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(acc)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(acc.id)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          </div>
        </div>
        <p className={`mt-4 text-2xl font-bold ${isLiability ? 'text-destructive' : 'text-success'}`}>
          {formatCurrency(isLiability ? Math.abs(acc.balance) : acc.balance)}
        </p>
        {acc.institution && (
          <p className="text-xs text-muted-foreground mt-1">
            {acc.institution}{acc.account_number_last4 ? ` ****${acc.account_number_last4}` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'checking', balance: '', institution: '', account_number_last4: '' });

  useEffect(() => { fetchAccounts(); }, []);

  function fetchAccounts() {
    api.get('/accounts').then(setAccounts);
  }

  function openAdd() {
    setEditAccount(null);
    setForm({ name: '', type: 'checking', balance: '', institution: '', account_number_last4: '' });
    setModalOpen(true);
  }

  function openEdit(acc) {
    setEditAccount(acc);
    setForm({ name: acc.name, type: acc.type, balance: acc.balance, institution: acc.institution || '', account_number_last4: acc.account_number_last4 || '' });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, balance: parseFloat(form.balance) || 0 };
    if (editAccount) {
      await api.put(`/accounts/${editAccount.id}`, payload);
    } else {
      await api.post('/accounts', payload);
    }
    setModalOpen(false);
    fetchAccounts();
  }

  async function handleDelete(id) {
    if (!confirm('Delete or deactivate this account?')) return;
    await api.delete(`/accounts/${id}`);
    fetchAccounts();
  }

  const activeAccounts = accounts.filter(a => a.is_active);
  const assets = activeAccounts.filter(a => !['credit_card', 'loan'].includes(a.type));
  const liabilities = activeAccounts.filter(a => ['credit_card', 'loan'].includes(a.type));
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Button onClick={openAdd}>+ Add Account</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalAssets)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Liabilities</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalLiabilities)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Net Worth</p>
            <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(netWorth)}
            </p>
          </CardContent>
        </Card>
      </div>

      {assets.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Assets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(acc => (
              <AccountCard key={acc.id} acc={acc} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        </>
      )}

      {liabilities.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Liabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liabilities.map(acc => (
              <AccountCard key={acc.id} acc={acc} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Current Balance</Label>
                <Input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Institution</Label>
                <Input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last 4 Digits</Label>
                <Input maxLength="4" value={form.account_number_last4} onChange={e => setForm(f => ({ ...f, account_number_last4: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">{editAccount ? 'Update' : 'Add'} Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
