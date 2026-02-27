import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../utils/api';
import { formatCurrency, formatDate, percentOf } from '../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Loading dashboard...</div>;
  if (!data) return <div className="empty-state">Failed to load dashboard</div>;

  const budgetPercent = percentOf(data.budgetOverview.totalBudgetSpent, data.budgetOverview.totalBudgeted);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-label">Net Worth</div>
          <div className="stat-value" style={{ color: data.netWorth >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(data.netWorth)}
          </div>
          <div className="stat-change text-muted">
            Assets: {formatCurrency(data.totalAssets)}
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Monthly Income</div>
          <div className="stat-value text-success">{formatCurrency(data.monthlyIncome)}</div>
          <div className="stat-change text-muted">This month</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Monthly Expenses</div>
          <div className="stat-value text-danger">{formatCurrency(data.monthlyExpenses)}</div>
          <div className="stat-change text-muted">This month</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Savings</div>
          <div className="stat-value" style={{ color: data.monthlySavings >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCurrency(data.monthlySavings)}
          </div>
          <div className="stat-change text-muted">Income - Expenses</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* Spending chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Daily Spending (30 days)</span>
            <Link to="/trends" className="btn btn-sm btn-secondary">View Trends</Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.dailySpending}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => formatCurrency(v)} labelFormatter={l => formatDate(l)} />
              <Area type="monotone" dataKey="total" stroke="#4F46E5" fill="url(#spendGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by category */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Spending by Category</span>
            <Link to="/trends" className="btn btn-sm btn-secondary">Details</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={data.spendingByCategory} dataKey="total" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {data.spendingByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, fontSize: '0.8125rem' }}>
              {data.spendingByCategory.slice(0, 6).map((cat, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color }} />
                    <span>{cat.icon} {cat.name}</span>
                  </div>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(cat.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {/* Budget overview */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Budget Status</span>
            <Link to="/budgets" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: budgetPercent > 90 ? 'var(--color-danger)' : budgetPercent > 70 ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {budgetPercent}%
            </div>
            <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
              {formatCurrency(data.budgetOverview.totalBudgetSpent)} of {formatCurrency(data.budgetOverview.totalBudgeted)}
            </div>
          </div>
          <div className="progress-bar" style={{ height: 10, marginBottom: 16 }}>
            <div className="progress-fill" style={{ width: `${Math.min(budgetPercent, 100)}%`, background: budgetPercent > 90 ? 'var(--color-danger)' : budgetPercent > 70 ? 'var(--color-warning)' : 'var(--color-success)' }} />
          </div>
          {data.budgetOverview.budgets.slice(0, 4).map((b, i) => {
            const pct = percentOf(b.spent, b.budgeted);
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                  <span>{b.category_icon} {b.category_name}</span>
                  <span className={pct > 100 ? 'text-danger' : ''}>{formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 100 ? 'var(--color-danger)' : b.category_color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Upcoming bills */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming Bills</span>
            <Link to="/bills" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {data.upcomingBills.map((bill, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < data.upcomingBills.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{bill.category_icon} {bill.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due: Day {bill.due_day}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatCurrency(bill.amount)}</div>
                {bill.is_autopay ? <span className="badge badge-success">Autopay</span> : <span className="badge badge-warning">Manual</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Goals */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Savings Goals</span>
            <Link to="/goals" className="btn btn-sm btn-secondary">View All</Link>
          </div>
          {data.goals.map((goal, i) => {
            const pct = percentOf(goal.current_amount, goal.target_amount);
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{goal.icon} {goal.name}</span>
                  <span>{pct}%</span>
                </div>
                <div className="progress-bar" style={{ marginBottom: 2 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: goal.color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{formatCurrency(goal.current_amount)}</span>
                  <span>{formatCurrency(goal.target_amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Transactions</span>
          <Link to="/transactions" className="btn btn-sm btn-secondary">View All</Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>{formatDate(tx.date)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{tx.description}</div>
                    {tx.merchant && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.merchant}</div>}
                  </td>
                  <td>
                    <span className="badge" style={{ background: tx.category_color + '20', color: tx.category_color }}>
                      {tx.category_icon} {tx.category_name}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{tx.account_name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accounts overview */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Accounts</span>
          <Link to="/accounts" className="btn btn-sm btn-secondary">Manage</Link>
        </div>
        <div className="grid grid-4">
          {data.accounts.filter(a => a.is_active).map(acc => (
            <div key={acc.id} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginBottom: 2 }}>
                {acc.type.replace('_', ' ')}
              </div>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 4 }}>{acc.name}</div>
              <div style={{ fontWeight: 700, color: acc.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {formatCurrency(acc.balance)}
              </div>
              {acc.institution && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{acc.institution}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
