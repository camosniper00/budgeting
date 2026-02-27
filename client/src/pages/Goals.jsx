import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate, percentOf } from '../utils/format';
import Modal from '../components/Modal';

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [addFundsModal, setAddFundsModal] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '', target_date: '', icon: '🎯', color: '#4F46E5' });

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

  const ICONS = ['🎯', '✈️', '🏠', '🚗', '💻', '📱', '🎓', '💒', '🏖️', '🛡️', '💰', '🎁'];

  return (
    <div>
      <div className="page-header">
        <h1>Savings Goals</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ New Goal</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-label">Total Goal Amount</div>
          <div className="stat-value">{formatCurrency(totalTarget)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Total Saved</div>
          <div className="stat-value text-success">{formatCurrency(totalSaved)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Remaining</div>
          <div className="stat-value">{formatCurrency(totalTarget - totalSaved)}</div>
        </div>
      </div>

      {activeGoals.length > 0 && (
        <div className="grid grid-2" style={{ marginBottom: 24 }}>
          {activeGoals.map(goal => {
            const pct = percentOf(goal.current_amount, goal.target_amount);
            const remaining = goal.target_amount - goal.current_amount;
            return (
              <div key={goal.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: goal.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      {goal.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{goal.name}</div>
                      {goal.target_date && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Target: {formatDate(goal.target_date)}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => { setAddFundsModal(goal); setAddAmount(''); }}>+ Add Funds</button>
                    <button className="btn-icon" onClick={() => openEdit(goal)}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(goal.id)} style={{ color: 'var(--color-danger)' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(goal.current_amount)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>of {formatCurrency(goal.target_amount)}</span>
                </div>

                <div className="progress-bar" style={{ height: 12, marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: goal.color }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: goal.color, fontWeight: 500 }}>{pct}% complete</span>
                  <span className="text-muted">{formatCurrency(remaining)} remaining</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completedGoals.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12, color: 'var(--color-success)' }}>Completed Goals</h2>
          <div className="grid grid-3">
            {completedGoals.map(goal => (
              <div key={goal.id} className="card" style={{ padding: 16, opacity: 0.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span>{goal.icon}</span>
                  <span style={{ fontWeight: 500 }}>{goal.name}</span>
                  <span className="badge badge-success">Complete</span>
                </div>
                <div style={{ fontWeight: 600 }}>{formatCurrency(goal.target_amount)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {goals.length === 0 && (
        <div className="card empty-state">
          <p>No savings goals yet. Create one to start tracking your progress!</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editGoal ? 'Edit Goal' : 'New Goal'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Goal Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ICONS.map(icon => (
                <button key={icon} type="button" onClick={() => setForm(f => ({ ...f, icon }))} style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: '1.125rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: form.icon === icon ? `2px solid ${form.color}` : '2px solid var(--border-color)', background: form.icon === icon ? form.color + '15' : 'transparent'
                }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Target Amount</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Current Amount</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Target Date</label>
              <input className="form-control" type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Color</label>
              <input className="form-control" type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ height: 42, padding: 4 }} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editGoal ? 'Update' : 'Create'} Goal</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!addFundsModal} onClose={() => setAddFundsModal(null)} title={`Add Funds to ${addFundsModal?.name}`}>
        <form onSubmit={handleAddFunds}>
          <div className="form-group">
            <label>Amount to Add</label>
            <input className="form-control" type="number" step="0.01" min="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} required autoFocus />
          </div>
          {addFundsModal && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Current: {formatCurrency(addFundsModal.current_amount)} / Target: {formatCurrency(addFundsModal.target_amount)}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setAddFundsModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Funds</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
