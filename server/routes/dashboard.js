const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  // Account balances summary
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND is_active = 1').all(req.userId);
  const totalAssets = accounts.filter(a => !['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  // This month's income/expenses
  const monthlyIncome = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?`).get(req.userId, monthStart, monthEnd);
  const monthlyExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`).get(req.userId, monthStart, monthEnd);

  // Spending by category this month
  const spendingByCategory = db.prepare(`
    SELECT c.name, c.icon, c.color, SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id ORDER BY total DESC LIMIT 10
  `).all(req.userId, monthStart, monthEnd);

  // Recent transactions
  const recentTransactions = db.prepare(`
    SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC, t.created_at DESC LIMIT 10
  `).all(req.userId);

  // Budget overview
  const budgets = db.prepare(`
    SELECT b.amount as budgeted, c.name as category_name, c.icon as category_icon, c.color as category_color,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.category_id = b.category_id AND t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?), 0) as spent
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.is_active = 1
  `).all(req.userId, monthStart, monthEnd, req.userId);

  const totalBudgeted = budgets.reduce((s, b) => s + b.budgeted, 0);
  const totalBudgetSpent = budgets.reduce((s, b) => s + b.spent, 0);

  // Upcoming bills
  const upcomingBills = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.is_active = 1
    ORDER BY b.due_day LIMIT 5
  `).all(req.userId);

  // Goals progress
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? AND is_completed = 0 ORDER BY target_date LIMIT 4').all(req.userId);

  // Daily spending for the last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailySpending = db.prepare(`
    SELECT date, SUM(amount) as total
    FROM transactions
    WHERE user_id = ? AND type = 'expense' AND date >= ?
    GROUP BY date ORDER BY date
  `).all(req.userId, thirtyDaysAgo.toISOString().split('T')[0]);

  res.json({
    netWorth: Math.round(netWorth * 100) / 100,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    monthlyIncome: monthlyIncome.total,
    monthlyExpenses: monthlyExpenses.total,
    monthlySavings: Math.round((monthlyIncome.total - monthlyExpenses.total) * 100) / 100,
    spendingByCategory,
    recentTransactions,
    budgetOverview: { budgets, totalBudgeted, totalBudgetSpent },
    upcomingBills,
    goals,
    dailySpending,
    accounts,
  });
});

module.exports = router;
