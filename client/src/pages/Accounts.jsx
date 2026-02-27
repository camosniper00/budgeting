import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import Modal from '../components/Modal';

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

  return (
    <div>
      <div className="page-header">
        <h1>Accounts</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Account</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value text-success">{formatCurrency(totalAssets)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Total Liabilities</div>
          <div className="stat-value text-danger">{formatCurrency(totalLiabilities)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Net Worth</div>
          <div className="stat-value" style={{ color: totalAssets - totalLiabilities >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(totalAssets - totalLiabilities)}
          </div>
        </div>
      </div>

      {assets.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Assets</h2>
          <div className="grid grid-3" style={{ marginBottom: 24 }}>
            {assets.map(acc => {
              const meta = TYPE_ICONS[acc.type] || TYPE_ICONS.other;
              return (
                <div key={acc.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                        {meta.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{acc.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{acc.type.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openEdit(acc)} title="Edit">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(acc.id)} style={{ color: 'var(--color-danger)' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>
                    {formatCurrency(acc.balance)}
                  </div>
                  {acc.institution && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{acc.institution} {acc.account_number_last4 ? `****${acc.account_number_last4}` : ''}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {liabilities.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 12 }}>Liabilities</h2>
          <div className="grid grid-3" style={{ marginBottom: 24 }}>
            {liabilities.map(acc => {
              const meta = TYPE_ICONS[acc.type] || TYPE_ICONS.other;
              return (
                <div key={acc.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                        {meta.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{acc.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{acc.type.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openEdit(acc)} title="Edit">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(acc.id)} style={{ color: 'var(--color-danger)' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                    {formatCurrency(Math.abs(acc.balance))}
                  </div>
                  {acc.institution && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>{acc.institution} {acc.account_number_last4 ? `****${acc.account_number_last4}` : ''}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editAccount ? 'Edit Account' : 'Add Account'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Account Name</label>
            <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Current Balance</label>
              <input className="form-control" type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Institution</label>
              <input className="form-control" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Last 4 Digits</label>
              <input className="form-control" maxLength="4" value={form.account_number_last4} onChange={e => setForm(f => ({ ...f, account_number_last4: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editAccount ? 'Update' : 'Add'} Account</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
