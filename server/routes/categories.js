const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY type, name').all(req.userId);
  res.json(categories);
});

router.post('/', (req, res) => {
  const { name, type, icon, color, parent_id } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  const id = uuidv4();
  db.prepare('INSERT INTO categories (id, user_id, name, type, icon, color, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, name, type, icon, color, parent_id);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json(category);
});

router.put('/:id', (req, res) => {
  const { name, icon, color } = req.body;
  db.prepare('UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color) WHERE id = ? AND user_id = ?')
    .run(name, icon, color, req.params.id, req.userId);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json(category);
});

router.delete('/:id', (req, res) => {
  const cat = db.prepare('SELECT is_system FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (cat && cat.is_system) return res.status(400).json({ error: 'Cannot delete system categories' });
  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ? AND is_system = 0').run(req.params.id, req.userId);
  res.json({ success: true });
});

module.exports = router;
