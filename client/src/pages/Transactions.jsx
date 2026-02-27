import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getCurrentMonth } from '../utils/format';
import Modal from '../components/Modal';

const PAGE_SIZE = 20;

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: '', type: '', category_id: '', account_id: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [form, setForm] = useState({ account_id: '', category_id: '', type: 'expense', amount: '', description: '', merchant: '', date: new Date().toISOString().split('T')[0], notes: '' });

  useEffect(() => {
    Promise.all([api.get('/accounts'), api.get('/categories')]).then(([a, c]) => {
      setAccounts(a);
      setCategories(c);
    });
  }, []);

  useEffect(() => { fetchTransactions(); }, [page, filters]);

  function fetchTransactions() {
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.category_id) params.set('category_id', filters.category_id);
    if (filters.account_id) params.set('account_id', filters.account_id);

    api.get(`/transactions?${params}`).then(data => {
      setTransactions(data.transactions);
      setTotal(data.total);
    });
  }

  function openAdd() {
    setEditTx(null);
    setForm({ account_id: accounts[0]?.id || '', category_id: '', type: 'expense', amount: '', description: '', merchant: '', date: new Date().toISOString().split('T')[0], notes: '' });
    setModalOpen(true);
  }

  function openEdit(tx) {
    setEditTx(tx);
    setForm({ account_id: tx.account_id, category_id: tx.category_id || '', type: tx.type, amount: tx.amount, description: tx.description, merchant: tx.merchant || '', date: tx.date, notes: tx.notes || '' });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount) };
    if (editTx) {
      await api.put(`/transactions/${editTx.id}`, payload);
    } else {
      await api.post('/transactions', payload);
    }
    setModalOpen(false);
    fetchTransactions();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this transaction?')) return;
    await api.delete(`/transactions/${id}`);
    fetchTransactions();
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');
  const filteredCategories = form.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <div>
      <div className="page-header">
        <h1>Transactions</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Transaction</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filter-bar">
          <input className="form-control" placeholder="Search transactions..." value={filters.search} onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }} style={{ minWidth: 220 }} />
          <select className="form-control" value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(0); }}>
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <select className="form-control" value={filters.category_id} onChange={e => { setFilters(f => ({ ...f, category_id: e.target.value })); setPage(0); }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select className="form-control" value={filters.account_id} onChange={e => { setFilters(f => ({ ...f, account_id: e.target.value })); setPage(0); }}>
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{tx.description}</div>
                    {tx.merchant && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.merchant}</div>}
                  </td>
                  <td>
                    {tx.category_name && (
                      <span className="badge" style={{ background: tx.category_color + '20', color: tx.category_color }}>
                        {tx.category_icon} {tx.category_name}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{tx.account_name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openEdit(tx)} title="Edit">
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(tx.id)} title="Delete" style={{ color: 'var(--color-danger)' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan="6" className="empty-state">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="pagination">
            <span>Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
            <div className="pagination-buttons">
              <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTx ? 'Edit Transaction' : 'Add Transaction'}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, category_id: '' }))}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input className="form-control" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Merchant</label>
              <input className="form-control" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input className="form-control" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Account</label>
              <select className="form-control" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Uncategorized</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea className="form-control" rows="2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editTx ? 'Update' : 'Add'} Transaction</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
