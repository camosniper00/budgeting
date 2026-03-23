import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../utils/api';
import { formatCurrency, formatDate, percentOf } from '../utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading dashboard...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Failed to load dashboard</div>;

  const budgetPercent = percentOf(data.budgetOverview.totalBudgetSpent, data.budgetOverview.totalBudgeted);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <span className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Net Worth</p>
            <p className={`text-2xl font-bold ${data.netWorth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(data.netWorth)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Assets: {formatCurrency(data.totalAssets)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Monthly Income</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(data.monthlyIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Monthly Expenses</p>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(data.monthlyExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Savings</p>
            <p className={`text-2xl font-bold ${data.monthlySavings >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(data.monthlySavings)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Income - Expenses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Daily Spending (30 days)</CardTitle>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/trends">View Trends</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Spending by category */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Spending by Category</CardTitle>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/trends">Details</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
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
              <div className="flex-1 text-[0.8125rem] space-y-1">
                {data.spendingByCategory.slice(0, 6).map((cat, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      <span>{cat.icon} {cat.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget overview */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Budget Status</CardTitle>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/budgets">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-3">
              <div className={`text-3xl font-bold ${budgetPercent > 90 ? 'text-destructive' : budgetPercent > 70 ? 'text-warning' : 'text-success'}`}>
                {budgetPercent}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(data.budgetOverview.totalBudgetSpent)} of {formatCurrency(data.budgetOverview.totalBudgeted)}
              </p>
            </div>
            <Progress
              value={Math.min(budgetPercent, 100)}
              className="h-2.5 mb-4"
              indicatorClassName={budgetPercent > 90 ? 'bg-destructive' : budgetPercent > 70 ? 'bg-warning' : 'bg-success'}
            />
            {data.budgetOverview.budgets.slice(0, 4).map((b, i) => {
              const pct = percentOf(b.spent, b.budgeted);
              return (
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{b.category_icon} {b.category_name}</span>
                    <span className={pct > 100 ? 'text-destructive font-medium' : ''}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className="h-1.5"
                    indicatorClassName={pct > 100 ? 'bg-destructive' : undefined}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Upcoming bills */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Bills</CardTitle>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/bills">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            {data.upcomingBills.map((bill, i) => (
              <div key={i} className={`flex justify-between items-center py-2.5 ${i < data.upcomingBills.length - 1 ? 'border-b' : ''}`}>
                <div>
                  <p className="text-sm font-medium">{bill.category_icon} {bill.name}</p>
                  <p className="text-xs text-muted-foreground">Due: Day {bill.due_day}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(bill.amount)}</p>
                  {bill.is_autopay
                    ? <Badge variant="success" className="text-xs">Autopay</Badge>
                    : <Badge variant="warning" className="text-xs">Manual</Badge>
                  }
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Savings Goals</CardTitle>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/goals">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.goals.map((goal, i) => {
              const pct = percentOf(goal.current_amount, goal.target_amount);
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{goal.icon} {goal.name}</span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5 mb-1" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(goal.current_amount)}</span>
                    <span>{formatCurrency(goal.target_amount)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/transactions">View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map(tx => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{tx.description}</div>
                      {tx.merchant && <div className="text-xs text-muted-foreground">{tx.merchant}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: tx.category_color + '20', color: tx.category_color }}>
                        {tx.category_icon} {tx.category_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{tx.account_name}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Accounts overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Accounts</CardTitle>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/accounts">Manage</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.accounts.filter(a => a.is_active).map(acc => (
              <div key={acc.id} className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground capitalize mb-1">{acc.type.replace('_', ' ')}</p>
                <p className="font-medium text-sm mb-1">{acc.name}</p>
                <p className={`font-bold ${acc.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(acc.balance)}
                </p>
                {acc.institution && <p className="text-xs text-muted-foreground mt-0.5">{acc.institution}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
