import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, getCurrentMonth, formatMonth, percentOf } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

export default function Budgets() {
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [month, setMonth] = useState(getCurrentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'monthly' });

  useEffect(() => {
    api.get('/categories').then(c => setCategories(c.filter(cat => cat.type === 'expense')));
  }, []);

  useEffect(() => { fetchBudgets(); }, [month]);

  function fetchBudgets() {
    api.get(`/budgets?month=${month}`).then(setData);
  }

  function openAdd() {
    setEditBudget(null);
    setForm({ category_id: '', amount: '', period: 'monthly' });
    setModalOpen(true);
  }

  function openEdit(b) {
    setEditBudget(b);
    setForm({ category_id: b.category_id, amount: b.amount, period: b.period });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount) };
    if (editBudget) {
      await api.put(`/budgets/${editBudget.id}`, payload);
    } else {
      await api.post('/budgets', payload);
    }
    setModalOpen(false);
    fetchBudgets();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this budget?')) return;
    await api.delete(`/budgets/${id}`);
    fetchBudgets();
  }

  function changeMonth(dir) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading budgets...</div>;

  const overallPct = percentOf(data.totalSpent, data.totalBudget);
  const remaining = data.totalBudget - data.totalSpent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMonth(-1)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
            <span className="font-medium min-w-[140px] text-center">{formatMonth(month)}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMonth(1)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Button>
          </div>
          <Button onClick={openAdd}>+ Add Budget</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Budgeted</p>
            <p className="text-2xl font-bold">{formatCurrency(data.totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(data.totalSpent)}</p>
            <Progress value={Math.min(overallPct, 100)} className="h-1.5 mt-2" indicatorClassName={overallPct > 100 ? 'bg-destructive' : undefined} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Remaining</p>
            <p className={`text-2xl font-bold ${remaining >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(remaining)}
            </p>
          </CardContent>
        </Card>
      </div>

      {data.budgets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No budgets set up yet. Create your first budget to start tracking spending!
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.budgets.map(b => {
            const pct = percentOf(b.spent, b.amount);
            const over = b.spent > b.amount;
            return (
              <Card key={b.id}>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">{b.category_icon} {b.category_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{b.period}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(b.id)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>
                      <span className={`font-semibold ${over ? 'text-destructive' : ''}`}>{formatCurrency(b.spent)}</span>
                      <span className="text-muted-foreground"> of {formatCurrency(b.amount)}</span>
                    </span>
                    <span className={`font-semibold ${over ? 'text-destructive' : 'text-success'}`}>
                      {over ? `${formatCurrency(b.spent - b.amount)} over` : `${formatCurrency(b.amount - b.spent)} left`}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className="h-2.5"
                    indicatorClassName={over ? 'bg-destructive' : pct > 80 ? 'bg-warning' : undefined}
                  />
                  <p className="text-right text-xs text-muted-foreground mt-1">{pct}% used</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBudget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={String(form.category_id)}
                onValueChange={v => setForm(f => ({ ...f, category_id: v }))}
                disabled={!!editBudget}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Budget Amount</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">{editBudget ? 'Update' : 'Create'} Budget</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
