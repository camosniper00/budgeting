import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

export default function Settings() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [categories, setCategories] = useState([]);
  const [saved, setSaved] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', icon: '📦', color: '#6B7280' });

  useEffect(() => {
    api.get('/categories').then(setCategories);
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    await api.put('/auth/me', { name, currency });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    await api.post('/categories', catForm);
    setCatModalOpen(false);
    api.get('/categories').then(setCategories);
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category? Transactions using it will become uncategorized.')) return;
    try {
      await api.delete(`/categories/${id}`);
      api.get('/categories').then(setCategories);
    } catch (err) {
      alert(err.message);
    }
  }

  const ICONS = ['📦', '🏠', '🚗', '🍔', '🛒', '💡', '🏥', '🎬', '🛍️', '💆', '📚', '🛡️', '📱', '✈️', '🎁', '🐾', '💼', '💻', '📈', '💰'];

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Profile */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Profile</span>
          </div>
          <form onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label>Name</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" value={user?.email || ''} disabled style={{ background: 'var(--bg-primary)' }} />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" className="btn btn-primary">Save Changes</button>
              {saved && <span className="text-success" style={{ fontSize: '0.875rem' }}>Saved!</span>}
            </div>
          </form>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12, color: 'var(--color-danger)' }}>Danger Zone</h3>
            <button className="btn btn-danger" onClick={logout}>Log Out</button>
          </div>
        </div>

        {/* Categories */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Categories</span>
            <button className="btn btn-sm btn-primary" onClick={() => { setCatForm({ name: '', type: 'expense', icon: '📦', color: '#6B7280' }); setCatModalOpen(true); }}>
              + Add
            </button>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {['income', 'expense', 'transfer'].map(type => {
              const typeCats = categories.filter(c => c.type === type);
              if (typeCats.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    {type}
                  </div>
                  {typeCats.map(cat => (
                    <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                        <span>{cat.icon} {cat.name}</span>
                      </div>
                      {!cat.is_system && (
                        <button className="btn-icon" onClick={() => handleDeleteCategory(cat.id)} style={{ color: 'var(--color-danger)', width: 28, height: 28 }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title="Add Category">
        <form onSubmit={handleAddCategory}>
          <div className="form-group">
            <label>Category Name</label>
            <input className="form-control" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select className="form-control" value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          <div className="form-group">
            <label>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICONS.map(icon => (
                <button key={icon} type="button" onClick={() => setCatForm(f => ({ ...f, icon }))} style={{
                  width: 32, height: 32, borderRadius: 6, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: catForm.icon === icon ? '2px solid var(--color-primary)' : '2px solid var(--border-color)', background: catForm.icon === icon ? 'var(--color-primary)10' : 'transparent'
                }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Color</label>
            <input className="form-control" type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} style={{ height: 42, padding: 4 }} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setCatModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Category</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
