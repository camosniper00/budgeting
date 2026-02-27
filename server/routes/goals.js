const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY is_completed, target_date').all(req.userId);
  res.json(goals);
});

router.post('/', (req, res) => {
  const { name, target_amount, current_amount, target_date, icon, color } = req.body;
  if (!name || !target_amount) return res.status(400).json({ error: 'name and target_amount are required' });

  const id = uuidv4();
  db.prepare('INSERT INTO goals (id, user_id, name, target_amount, current_amount, target_date, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, name, target_amount, current_amount || 0, target_date, icon, color || '#4F46E5');

  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  res.status(201).json(goal);
});

router.put('/:id', (req, res) => {
  const { name, target_amount, current_amount, target_date, icon, color, is_completed } = req.body;
  db.prepare(`UPDATE goals SET
    name = COALESCE(?, name), target_amount = COALESCE(?, target_amount),
    current_amount = COALESCE(?, current_amount), target_date = COALESCE(?, target_date),
    icon = COALESCE(?, icon), color = COALESCE(?, color),
    is_completed = COALESCE(?, is_completed), updated_at = datetime('now')
    WHERE id = ? AND user_id = ?`)
    .run(name, target_amount, current_amount, target_date, icon, color, is_completed, req.params.id, req.userId);

  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id);
  res.json(goal);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

module.exports = router;
