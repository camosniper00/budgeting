import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { api } from '../utils/api';
import { formatCurrency, getCurrentMonth, formatMonth, getMonthRange } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spending Trends</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMonth(-1)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
          <span className="font-medium min-w-[140px] text-center">{formatMonth(month)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => changeMonth(1)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
        </div>
      </div>

      {/* Income vs Expenses */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Income vs Expenses (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Spending by Category</CardTitle>
              {categories && <span className="text-sm font-semibold">Total: {formatCurrency(categories.totalSpending)}</span>}
            </div>
          </CardHeader>
          <CardContent>
            {categories && categories.categories.length > 0 ? (
              <div className="flex gap-5 items-center">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={categories.categories} dataKey="total" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {categories.categories.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1 max-h-[200px] overflow-y-auto text-[0.8125rem]">
                  {categories.categories.map((cat, i) => (
                    <div key={i} className="flex justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span>{cat.icon} {cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(cat.total)}</span>
                        <span className="text-muted-foreground ml-2">{cat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No spending data for this month</p>
            )}
          </CardContent>
        </Card>

        {/* Top merchants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {merchants.length > 0 ? (
              <div className="space-y-3">
                {merchants.map((m, i) => {
                  const maxAmount = merchants[0].total;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{m.merchant}</span>
                        <span>{formatCurrency(m.total)} ({m.count}x)</span>
                      </div>
                      <Progress value={(m.total / maxAmount) * 100} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No merchant data for this month</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Category Spending Trend</CardTitle>
            <select
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="">All Expenses</option>
              {allCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={categoryTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Line type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Savings trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Savings</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
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
        </CardContent>
      </Card>
    </div>
  );
}
