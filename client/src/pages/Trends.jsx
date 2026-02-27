import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { api } from '../utils/api';
import { formatCurrency, getCurrentMonth, formatMonth, getMonthRange } from '../utils/format';

export default function Trends() {
  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [categoryTrend, setCategoryTrend] = useState([]);
  const [month, setMonth] = useState(getCurrentMonth());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [allCategories, setAllCategories] = useState([]);

  useEffect(() => {
    api.get('/trends/monthly').then(setMonthly);
    api.get('/categories').then(c => setAllCategories(c.filter(cat => cat.type === 'expense')));
  }, []);

  useEffect(() => {
    const { start, end } = getMonthRange(month);
    Promise.all([
      api.get(`/trends/categories?start_date=${start}&end_date=${end}`),
      api.get(`/trends/merchants?start_date=${start}&end_date=${end}`),
    ]).then(([c, m]) => {
      setCategories(c);
      setMerchants(m);
    });
  }, [month]);

  useEffect(() => {
    const params = selectedCategory ? `?category_id=${selectedCategory}&months=6` : '?months=6';
    api.get(`/trends/category-trend${params}`).then(setCategoryTrend);
  }, [selectedCategory]);

  function changeMonth(dir) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Spending Trends</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-icon" onClick={() => changeMonth(-1)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontWeight: 500, minWidth: 140, textAlign: 'center' }}>{formatMonth(month)}</span>
          <button className="btn-icon" onClick={() => changeMonth(1)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>

      {/* Income vs Expenses */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Income vs Expenses (12 Months)</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* Category breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spending by Category</span>
            {categories && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Total: {formatCurrency(categories.totalSpending)}</span>}
          </div>
          {categories && categories.categories.length > 0 ? (
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={categories.categories} dataKey="total" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {categories.categories.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, maxHeight: 200, overflowY: 'auto' }}>
                {categories.categories.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <span>{cat.icon} {cat.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 500 }}>{formatCurrency(cat.total)}</span>
                      <span className="text-muted" style={{ marginLeft: 8 }}>{cat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state"><p>No spending data for this month</p></div>
          )}
        </div>

        {/* Top merchants */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Merchants</span>
          </div>
          {merchants.length > 0 ? (
            <div>
              {merchants.map((m, i) => {
                const maxAmount = merchants[0].total;
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{m.merchant}</span>
                      <span>{formatCurrency(m.total)} ({m.count}x)</span>
                    </div>
                    <div className="progress-bar" style={{ height: 6 }}>
                      <div className="progress-fill" style={{ width: `${(m.total / maxAmount) * 100}%`, background: 'var(--color-primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><p>No merchant data for this month</p></div>
          )}
        </div>
      </div>

      {/* Category trend */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Category Spending Trend</span>
          <select className="form-control" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ width: 200 }}>
            <option value="">All Expenses</option>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={categoryTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Savings trend */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Monthly Savings</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Bar dataKey="savings" name="Savings" fill="#4F46E5" radius={[4, 4, 0, 0]}>
              {monthly.map((entry, i) => (
                <Cell key={i} fill={entry.savings >= 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
