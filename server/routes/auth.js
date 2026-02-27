const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, name);

  // Create default categories for new user
  const defaultCategories = [
    { name: 'Salary', type: 'income', icon: '💼', color: '#10B981' },
    { name: 'Freelance', type: 'income', icon: '💻', color: '#34D399' },
    { name: 'Housing', type: 'expense', icon: '🏠', color: '#EF4444' },
    { name: 'Transportation', type: 'expense', icon: '🚗', color: '#F97316' },
    { name: 'Food & Dining', type: 'expense', icon: '🍔', color: '#F59E0B' },
    { name: 'Groceries', type: 'expense', icon: '🛒', color: '#EAB308' },
    { name: 'Utilities', type: 'expense', icon: '💡', color: '#84CC16' },
    { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#14B8A6' },
    { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#06B6D4' },
    { name: 'Healthcare', type: 'expense', icon: '🏥', color: '#22C55E' },
    { name: 'Miscellaneous', type: 'expense', icon: '📦', color: '#78716C' },
    { name: 'Transfer', type: 'transfer', icon: '🔄', color: '#6B7280' },
  ];

  const insertCat = db.prepare('INSERT INTO categories (id, user_id, name, type, icon, color, is_system) VALUES (?, ?, ?, ?, ?, ?, 1)');
  for (const cat of defaultCategories) {
    insertCat.run(uuidv4(), id, cat.name, cat.type, cat.icon, cat.color);
  }

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, email, name } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, currency: user.currency } });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, name, currency, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.put('/me', authenticate, (req, res) => {
  const { name, currency } = req.body;
  db.prepare('UPDATE users SET name = COALESCE(?, name), currency = COALESCE(?, currency), updated_at = datetime(\'now\') WHERE id = ?')
    .run(name, currency, req.userId);
  const user = db.prepare('SELECT id, email, name, currency FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

module.exports = router;
