import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import Modal from '../components/Modal';

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

  if (!data) return <div className="empty-state">Loading bills...</div>;

  const today = new Date().getDate();

  return (
    <div>
      <div className="page-header">
        <h1>Bills & Recurring</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Bill</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-label">Monthly Bills Total</div>
          <div className="stat-value">{formatCurrency(data.totalMonthly)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Active Bills</div>
          <div className="stat-value">{data.bills.length}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">On Autopay</div>
          <div className="stat-value">{data.bills.filter(b => b.is_autopay).length} / {data.bills.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Bills</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Amount</th>
                <th>Due Day</th>
                <th>Frequency</th>
                <th>Account</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map(bill => {
                const isPast = bill.due_day < today;
                const isSoon = bill.due_day - today <= 5 && bill.due_day >= today;
                return (
                  <tr key={bill.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{bill.category_icon || '📋'}</span>
                        <div>
                          <div style={{ fontWeight: 500 }}>{bill.name}</div>
                          {bill.category_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bill.category_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(bill.amount)}</td>
                    <td>Day {bill.due_day}</td>
                    <td style={{ textTransform: 'capitalize' }}>{bill.frequency}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{bill.account_name || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {bill.is_autopay ? <span className="badge badge-success">Autopay</span> : <span className="badge badge-warning">Manual</span>}
                        {isPast && <span className="badge badge-info">Paid</span>}
                        {isSoon && !isPast && <span className="badge badge-danger">Due Soon</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => openEdit(bill)}>
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(bill.id)} style={{ color: 'var(--color-danger)' }}>
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editBill ? 'Edit Bill' : 'Add Bill'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Bill Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Amount</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Due Day of Month</label>
              <input className="form-control" type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Frequency</label>
              <select className="form-control" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Pay From Account</label>
              <select className="form-control" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
                <option value="">None</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_autopay} onChange={e => setForm(f => ({ ...f, is_autopay: e.target.checked }))} />
                Autopay enabled
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editBill ? 'Update' : 'Add'} Bill</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
