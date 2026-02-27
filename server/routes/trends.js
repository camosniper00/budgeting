const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Monthly income vs expenses for the last 12 months
router.get('/monthly', (req, res) => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const start = `${monthStr}-01`;
    const end = `${monthStr}-31`;

    const income = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?`).get(req.userId, start, end);
    const expenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`).get(req.userId, start, end);

    months.push({
      month: monthStr,
      label: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      income: income.total,
      expenses: expenses.total,
      savings: Math.round((income.total - expenses.total) * 100) / 100,
    });
  }
  res.json(months);
});

// Spending by category for a given period
router.get('/categories', (req, res) => {
  const { start_date, end_date } = req.query;
  const now = new Date();
  const start = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = end_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  const categories = db.prepare(`
    SELECT c.name, c.icon, c.color, SUM(t.amount) as total, COUNT(t.id) as count
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id ORDER BY total DESC
  `).all(req.userId, start, end);

  const totalSpending = categories.reduce((s, c) => s + c.total, 0);
  const withPercentage = categories.map(c => ({
    ...c,
    percentage: totalSpending > 0 ? Math.round((c.total / totalSpending) * 1000) / 10 : 0,
  }));

  res.json({ categories: withPercentage, totalSpending });
});

// Spending over time by category
router.get('/category-trend', (req, res) => {
  const { category_id, months: numMonths } = req.query;
  const monthCount = parseInt(numMonths) || 6;
  const now = new Date();
  const data = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const start = `${monthStr}-01`;
    const end = `${monthStr}-31`;

    let query = `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`;
    const params = [req.userId, start, end];
    if (category_id) { query += ' AND category_id = ?'; params.push(category_id); }

    const result = db.prepare(query).get(...params);
    data.push({
      month: monthStr,
      label: d.toLocaleString('default', { month: 'short' }),
      total: result.total,
    });
  }
  res.json(data);
});

// Top merchants
router.get('/merchants', (req, res) => {
  const { start_date, end_date } = req.query;
  const now = new Date();
  const start = start_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = end_date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  const merchants = db.prepare(`
    SELECT merchant, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE user_id = ? AND type = 'expense' AND merchant IS NOT NULL AND date >= ? AND date <= ?
    GROUP BY merchant ORDER BY total DESC LIMIT 15
  `).all(req.userId, start, end);

  res.json(merchants);
});

module.exports = router;
