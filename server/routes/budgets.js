const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { month } = req.query; // format: YYYY-MM
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = `${targetMonth}-01`;
  const endDate = `${targetMonth}-31`;

  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color,
    COALESCE((
      SELECT SUM(t.amount) FROM transactions t
      WHERE t.category_id = b.category_id AND t.user_id = ? AND t.type = 'expense'
      AND t.date >= ? AND t.date <= ?
    ), 0) as spent
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.is_active = 1
    ORDER BY c.name
  `).all(req.userId, startDate, endDate, req.userId);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  res.json({ budgets, totalBudget, totalSpent, month: targetMonth });
});

router.post('/', (req, res) => {
  const { category_id, amount, period, start_date } = req.body;
  if (!category_id || !amount) return res.status(400).json({ error: 'category_id and amount are required' });

  const id = uuidv4();
  db.prepare('INSERT INTO budgets (id, user_id, category_id, amount, period, start_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, category_id, amount, period || 'monthly', start_date || new Date().toISOString().split('T')[0]);

  const budget = db.prepare('SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM budgets b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?').get(id);
  res.status(201).json(budget);
});

router.put('/:id', (req, res) => {
  const { amount, is_active } = req.body;
  db.prepare('UPDATE budgets SET amount = COALESCE(?, amount), is_active = COALESCE(?, is_active), updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?')
    .run(amount, is_active, req.params.id, req.userId);
  const budget = db.prepare('SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM budgets b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?').get(req.params.id);
  res.json(budget);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

module.exports = router;
