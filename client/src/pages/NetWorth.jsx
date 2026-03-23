import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function NetWorth() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/networth').then(setData);
  }, []);

  async function takeSnapshot() {
    await api.post('/networth/snapshot');
    api.get('/networth').then(setData);
  }

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading net worth data...</div>;

  const historyData = data.history.map(s => ({
    date: s.date,
    assets: s.total_assets,
    liabilities: s.total_liabilities,
    netWorth: s.net_worth,
  }));
  historyData.push({
    date: 'Now',
    assets: data.totalAssets,
    liabilities: data.totalLiabilities,
    netWorth: data.netWorth,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Net Worth</h1>
        <Button onClick={takeSnapshot}>Take Snapshot</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(data.totalAssets)}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.assets.length} accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Total Liabilities</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(data.totalLiabilities)}</p>
            <p className="text-xs text-muted-foreground mt-1">{data.liabilities.length} accounts</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary to-purple-600 border-0">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80 mb-1">Net Worth</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(data.netWorth)}</p>
            {data.history.length > 0 && (
              <p className="text-xs text-white/70 mt-1">
                {data.netWorth > data.history[data.history.length - 1].net_worth ? '↑' : '↓'}{' '}
                {formatCurrency(Math.abs(data.netWorth - data.history[data.history.length - 1].net_worth))} since last snapshot
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
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
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={d => d === 'Now' ? d : d.slice(0, 7)} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Area type="monotone" dataKey="assets" name="Assets" stroke="#10B981" fill="url(#assetGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="liabilities" name="Liabilities" stroke="#EF4444" fill="url(#liabGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#4F46E5" fill="url(#nwGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assets</CardTitle>
              <span className="text-base font-semibold text-success">{formatCurrency(data.totalAssets)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {data.assets.map((acc, i) => (
              <div key={acc.id}>
                <div className="flex justify-between items-center py-3">
                  <div>
                    <p className="font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {acc.type.replace('_', ' ')}{acc.institution ? ` • ${acc.institution}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-success">{formatCurrency(acc.balance)}</span>
                </div>
                {i < data.assets.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Liabilities</CardTitle>
              <span className="text-base font-semibold text-destructive">{formatCurrency(data.totalLiabilities)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {data.liabilities.length > 0 ? data.liabilities.map((acc, i) => (
              <div key={acc.id}>
                <div className="flex justify-between items-center py-3">
                  <div>
                    <p className="font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {acc.type.replace('_', ' ')}{acc.institution ? ` • ${acc.institution}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-destructive">{formatCurrency(Math.abs(acc.balance))}</span>
                </div>
                {i < data.liabilities.length - 1 && <Separator />}
              </div>
            )) : (
              <p className="text-center text-muted-foreground py-8">No liabilities - great job!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
