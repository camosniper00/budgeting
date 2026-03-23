import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate, percentOf } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ICONS = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💒', '🏖️', '🛡️', '💰', '🎁'];

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [addFundsModal, setAddFundsModal] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '0', target_date: '', icon: '🎯', color: '#4F46E5' });

  useEffect(() => { fetchGoals(); }, []);

  function fetchGoals() {
    api.get('/goals').then(setGoals);
  }

  function openAdd() {
    setEditGoal(null);
    setForm({ name: '', target_amount: '', current_amount: '0', target_date: '', icon: '🎯', color: '#4F46E5' });
    setModalOpen(true);
  }

  function openEdit(g) {
    setEditGoal(g);
    setForm({ name: g.name, target_amount: g.target_amount, current_amount: g.current_amount, target_date: g.target_date || '', icon: g.icon || '🎯', color: g.color });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, target_amount: parseFloat(form.target_amount), current_amount: parseFloat(form.current_amount) || 0 };
    if (editGoal) {
      await api.put(`/goals/${editGoal.id}`, payload);
    } else {
      await api.post('/goals', payload);
    }
    setModalOpen(false);
    fetchGoals();
  }

  async function handleAddFunds(e) {
    e.preventDefault();
    const newAmount = addFundsModal.current_amount + parseFloat(addAmount);
    const isCompleted = newAmount >= addFundsModal.target_amount;
    await api.put(`/goals/${addFundsModal.id}`, { current_amount: newAmount, is_completed: isCompleted ? 1 : 0 });
    setAddFundsModal(null);
    setAddAmount('');
    fetchGoals();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this goal?')) return;
    await api.delete(`/goals/${id}`);
    fetchGoals();
  }

  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved = activeGoals.reduce((s, g) => s + g.current_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Savings Goals</h1>
        <Button onClick={openAdd}>+ New Goal</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Goal Amount</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTarget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Saved</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalSaved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Remaining</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTarget - totalSaved)}</p>
          </CardContent>
        </Card>
      </div>

      {goals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No savings goals yet. Create one to start tracking your progress!
          </CardContent>
        </Card>
      )}

      {activeGoals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeGoals.map(goal => {
            const pct = percentOf(goal.current_amount, goal.target_amount);
            const remaining = goal.target_amount - goal.current_amount;
            return (
              <Card key={goal.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: goal.color + '18' }}>
                        {goal.icon}
                      </div>
                      <div>
                        <p className="text-base font-semibold">{goal.name}</p>
                        {goal.target_date && <p className="text-xs text-muted-foreground">Target: {formatDate(goal.target_date)}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => { setAddFundsModal(goal); setAddAmount(''); }}>+ Add Funds</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(goal)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(goal.id)}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between mb-2">
                    <span className="text-xl font-bold">{formatCurrency(goal.current_amount)}</span>
                    <span className="text-muted-foreground">of {formatCurrency(goal.target_amount)}</span>
                  </div>

                  <Progress value={Math.min(pct, 100)} className="h-3 mb-2" />

                  <div className="flex justify-between text-xs">
                    <span className="font-medium" style={{ color: goal.color }}>{pct}% complete</span>
                    <span className="text-muted-foreground">{formatCurrency(remaining)} remaining</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {completedGoals.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-success">Completed Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {completedGoals.map(goal => (
              <Card key={goal.id} className="opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{goal.icon}</span>
                    <span className="font-medium">{goal.name}</span>
                    <Badge variant="success">Complete</Badge>
                  </div>
                  <p className="font-semibold">{formatCurrency(goal.target_amount)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Goal form modal */}
      <Dialog open={modalOpen} onOpenChange={open => !open && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editGoal ? 'Edit Goal' : 'New Goal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Goal Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    className={cn(
                      'w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors',
                      form.icon === icon ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Target Amount</Label>
                <Input type="number" step="0.01" min="0" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Current Amount</Label>
                <Input type="number" step="0.01" min="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Target Date</Label>
                <Input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="h-9 w-full rounded-md border border-input cursor-pointer p-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">{editGoal ? 'Update' : 'Create'} Goal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add funds modal */}
      <Dialog open={!!addFundsModal} onOpenChange={open => !open && setAddFundsModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funds to {addFundsModal?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddFunds} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount to Add</Label>
              <Input type="number" step="0.01" min="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} required autoFocus />
            </div>
            {addFundsModal && (
              <p className="text-sm text-muted-foreground">
                Current: {formatCurrency(addFundsModal.current_amount)} / Target: {formatCurrency(addFundsModal.target_amount)}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAddFundsModal(null)}>Cancel</Button>
              <Button type="submit">Add Funds</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
