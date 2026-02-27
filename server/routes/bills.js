const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const bills = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, a.name as account_name
    FROM bills b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    WHERE b.user_id = ? AND b.is_active = 1
    ORDER BY b.due_day
  `).all(req.userId);

  const totalMonthly = bills.reduce((sum, b) => {
    if (b.frequency === 'monthly') return sum + b.amount;
    if (b.frequency === 'weekly') return sum + b.amount * 4.33;
    if (b.frequency === 'biweekly') return sum + b.amount * 2.17;
    if (b.frequency === 'yearly') return sum + b.amount / 12;
    return sum;
  }, 0);

  res.json({ bills, totalMonthly: Math.round(totalMonthly * 100) / 100 });
});

router.post('/', (req, res) => {
  const { name, amount, due_day, frequency, category_id, account_id, is_autopay } = req.body;
  if (!name || !amount || !due_day || !frequency) {
    return res.status(400).json({ error: 'name, amount, due_day, and frequency are required' });
  }

  const id = uuidv4();
  const now = new Date();
  const nextDue = new Date(now.getFullYear(), now.getMonth(), due_day);
  if (nextDue < now) nextDue.setMonth(nextDue.getMonth() + 1);

  db.prepare('INSERT INTO bills (id, user_id, name, amount, due_day, frequency, category_id, account_id, is_autopay, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, name, amount, due_day, frequency, category_id, account_id, is_autopay ? 1 : 0, nextDue.toISOString().split('T')[0]);

  const bill = db.prepare('SELECT b.*, c.name as category_name, c.icon as category_icon, a.name as account_name FROM bills b LEFT JOIN categories c ON b.category_id = c.id LEFT JOIN accounts a ON b.account_id = a.id WHERE b.id = ?').get(id);
  res.status(201).json(bill);
});

router.put('/:id', (req, res) => {
  const { name, amount, due_day, frequency, category_id, account_id, is_autopay, is_active } = req.body;
  db.prepare(`UPDATE bills SET
    name = COALESCE(?, name), amount = COALESCE(?, amount), due_day = COALESCE(?, due_day),
    frequency = COALESCE(?, frequency), category_id = COALESCE(?, category_id),
    account_id = COALESCE(?, account_id), is_autopay = COALESCE(?, is_autopay),
    is_active = COALESCE(?, is_active), updated_at = datetime('now')
    WHERE id = ? AND user_id = ?`)
    .run(name, amount, due_day, frequency, category_id, account_id, is_autopay, is_active, req.params.id, req.userId);

  const bill = db.prepare('SELECT b.*, c.name as category_name, c.icon as category_icon, a.name as account_name FROM bills b LEFT JOIN categories c ON b.category_id = c.id LEFT JOIN accounts a ON b.account_id = a.id WHERE b.id = ?').get(req.params.id);
  res.json(bill);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bills WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

module.exports = router;
