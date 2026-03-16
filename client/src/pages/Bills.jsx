import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

export default function Bills() {
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', due_day: '', frequency: 'monthly', category_id: '', account_id: '', is_autopay: false });

  useEffect(() => {
    Promise.all([api.get('/bills'), api.get('/accounts'), api.get('/categories')]).then(([b, a, c]) => {
      setData(b);
      setAccounts(a);
      setCategories(c.filter(cat => cat.type === 'expense'));
    });
  }, []);

  function fetchBills() {
    api.get('/bills').then(setData);
  }

  function openAdd() {
    setEditBill(null);
    setForm({ name: '', amount: '', due_day: '', frequency: 'monthly', category_id: '', account_id: '', is_autopay: false });
    setModalOpen(true);
  }

  function openEdit(b) {
    setEditBill(b);
    setForm({ name: b.name, amount: b.amount, due_day: b.due_day, frequency: b.frequency, category_id: b.category_id || '', account_id: b.account_id || '', is_autopay: !!b.is_autopay });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount), due_day: parseInt(form.due_day), is_autopay: form.is_autopay };
    if (editBill) {
      await api.put(`/bills/${editBill.id}`, payload);
    } else {
      await api.post('/bills', payload);
    }
    setModalOpen(false);
    fetchBills();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this bill?')) return;
    await api.delete(`/bills/${id}`);
    fetchBills();
  }

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading bills...</div>;

  const today = new Date().getDate();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bills &amp; Recurring</h1>
        <Button onClick={openAdd}>+ Add Bill</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Monthly Bills Total</p>
            <p className="text-2xl font-bold">{formatCurrency(data.totalMonthly)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Active Bills</p>
            <p className="text-2xl font-bold">{data.bills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">On Autopay</p>
            <p className="text-2xl font-bold">{data.bills.filter(b => b.is_autopay).length} / {data.bills.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All Bills</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frequency</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {data.bills.map(bill => {
                  const isPast = bill.due_day < today;
                  const isSoon = bill.due_day - today <= 5 && bill.due_day >= today;
                  return (
                    <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{bill.category_icon || '📋'}</span>
                          <div>
                            <div className="font-medium">{bill.name}</div>
                            {bill.category_name && <div className="text-xs text-muted-foreground">{bill.category_name}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(bill.amount)}</td>
                      <td className="px-4 py-3">Day {bill.due_day}</td>
                      <td className="px-4 py-3 capitalize">{bill.frequency}</td>
                      <td className="px-4 py-3 text-muted-foreground">{bill.account_name || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {bill.is_autopay ? <Badge variant="success">Autopay</Badge> : <Badge variant="warning">Manual</Badge>}
                          {isPast && <Badge variant="secondary">Paid</Badge>}
                          {isSoon && !isPast && <Badge variant="destructive">Due Soon</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(bill)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(bill.id)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBill ? 'Edit Bill' : 'Add Bill'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Bill Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Due Day of Month</Label>
                <Input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={String(form.category_id)} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Pay From Account</Label>
              <Select value={String(form.account_id)} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="autopay"
                checked={form.is_autopay}
                onCheckedChange={v => setForm(f => ({ ...f, is_autopay: v }))}
              />
              <Label htmlFor="autopay" className="cursor-pointer font-normal">Autopay enabled</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">{editBill ? 'Update' : 'Add'} Bill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
