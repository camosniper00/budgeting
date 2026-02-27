import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function NetWorth() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/networth').then(setData);
  }, []);

  async function takeSnapshot() {
    await api.post('/networth/snapshot');
    api.get('/networth').then(setData);
  }

  if (!data) return <div className="empty-state">Loading net worth data...</div>;

  const historyData = data.history.map(s => ({
    date: s.date,
    assets: s.total_assets,
    liabilities: s.total_liabilities,
    netWorth: s.net_worth,
  }));

  // Add current snapshot
  historyData.push({
    date: 'Now',
    assets: data.totalAssets,
    liabilities: data.totalLiabilities,
    netWorth: data.netWorth,
  });

  return (
    <div>
      <div className="page-header">
        <h1>Net Worth</h1>
        <button className="btn btn-primary" onClick={takeSnapshot}>Take Snapshot</button>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value text-success">{formatCurrency(data.totalAssets)}</div>
          <div className="stat-change text-muted">{data.assets.length} accounts</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Total Liabilities</div>
          <div className="stat-value text-danger">{formatCurrency(data.totalLiabilities)}</div>
          <div className="stat-change text-muted">{data.liabilities.length} accounts</div>
        </div>
        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', border: 'none' }}>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.8)' }}>Net Worth</div>
          <div className="stat-value" style={{ color: 'white' }}>{formatCurrency(data.netWorth)}</div>
          {data.history.length > 0 && (
            <div className="stat-change" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {data.netWorth > data.history[data.history.length - 1].net_worth ? '↑' : '↓'}{' '}
              {formatCurrency(Math.abs(data.netWorth - data.history[data.history.length - 1].net_worth))} since last snapshot
            </div>
          )}
        </div>
      </div>

      {/* Net worth chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Net Worth Over Time</span>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={historyData}>
            <defs>
              <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={d => d === 'Now' ? d : d.slice(0, 7)} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => formatCurrency(v)} />
            <Area type="monotone" dataKey="assets" name="Assets" stroke="#10B981" fill="url(#assetGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="liabilities" name="Liabilities" stroke="#EF4444" fill="url(#liabGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#4F46E5" fill="url(#nwGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-2">
        {/* Assets breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Assets</span>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(data.totalAssets)}</span>
          </div>
          {data.assets.map(acc => (
            <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{acc.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {acc.type.replace('_', ' ')} {acc.institution ? `• ${acc.institution}` : ''}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(acc.balance)}</div>
            </div>
          ))}
        </div>

        {/* Liabilities breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Liabilities</span>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-danger)' }}>{formatCurrency(data.totalLiabilities)}</span>
          </div>
          {data.liabilities.length > 0 ? data.liabilities.map(acc => (
            <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{acc.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {acc.type.replace('_', ' ')} {acc.institution ? `• ${acc.institution}` : ''}
                </div>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{formatCurrency(Math.abs(acc.balance))}</div>
            </div>
          )) : (
            <div className="empty-state"><p>No liabilities - great job!</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
