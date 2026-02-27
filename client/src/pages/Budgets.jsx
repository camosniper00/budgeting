import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, getCurrentMonth, formatMonth, percentOf } from '../utils/format';
import Modal from '../components/Modal';

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

  if (!data) return <div className="empty-state">Loading budgets...</div>;

  const overallPct = percentOf(data.totalSpent, data.totalBudget);
  const remaining = data.totalBudget - data.totalSpent;

  return (
    <div>
      <div className="page-header">
        <h1>Budgets</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-icon" onClick={() => changeMonth(-1)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span style={{ fontWeight: 500, minWidth: 140, textAlign: 'center' }}>{formatMonth(month)}</span>
            <button className="btn-icon" onClick={() => changeMonth(1)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Budget</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-label">Total Budgeted</div>
          <div className="stat-value">{formatCurrency(data.totalBudget)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Total Spent</div>
          <div className="stat-value text-danger">{formatCurrency(data.totalSpent)}</div>
          <div className="progress-bar" style={{ marginTop: 8, height: 6 }}>
            <div className="progress-fill" style={{ width: `${Math.min(overallPct, 100)}%`, background: overallPct > 100 ? 'var(--color-danger)' : 'var(--color-primary)' }} />
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Remaining</div>
          <div className="stat-value" style={{ color: remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(remaining)}
          </div>
        </div>
      </div>

      {/* Budget list */}
      <div className="grid grid-2">
        {data.budgets.map(b => {
          const pct = percentOf(b.spent, b.amount);
          const over = b.spent > b.amount;
          return (
            <div key={b.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>{b.category_icon} {b.category_name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{b.period}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" onClick={() => openEdit(b)} title="Edit">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button className="btn-icon" onClick={() => handleDelete(b.id)} title="Delete" style={{ color: 'var(--color-danger)' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.875rem' }}>
                  <span style={{ fontWeight: 600, color: over ? 'var(--color-danger)' : '' }}>{formatCurrency(b.spent)}</span>
                  <span className="text-muted"> of {formatCurrency(b.amount)}</span>
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: over ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {over ? `${formatCurrency(b.spent - b.amount)} over` : `${formatCurrency(b.amount - b.spent)} left`}
                </span>
              </div>
              <div className="progress-bar" style={{ height: 10 }}>
                <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: over ? 'var(--color-danger)' : pct > 80 ? 'var(--color-warning)' : b.category_color }} />
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{pct}% used</div>
            </div>
          );
        })}
      </div>

      {data.budgets.length === 0 && (
        <div className="card empty-state">
          <p>No budgets set up yet. Create your first budget to start tracking spending!</p>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editBudget ? 'Edit Budget' : 'Add Budget'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category</label>
            <select className="form-control" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required disabled={!!editBudget}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Budget Amount</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Period</label>
              <select className="form-control" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editBudget ? 'Update' : 'Create'} Budget</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
