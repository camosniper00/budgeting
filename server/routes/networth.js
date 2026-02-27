const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND is_active = 1 ORDER BY type, name').all(req.userId);

  const assets = accounts.filter(a => !['credit_card', 'loan'].includes(a.type));
  const liabilities = accounts.filter(a => ['credit_card', 'loan'].includes(a.type));

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);

  const snapshots = db.prepare('SELECT * FROM net_worth_snapshots WHERE user_id = ? ORDER BY date').all(req.userId);

  res.json({
    assets,
    liabilities,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    netWorth: Math.round((totalAssets - totalLiabilities) * 100) / 100,
    history: snapshots,
  });
});

router.post('/snapshot', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND is_active = 1').all(req.userId);
  const totalAssets = accounts.filter(a => !['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + Math.abs(a.balance), 0);

  const breakdown = {};
  accounts.forEach(a => { breakdown[a.name] = a.balance; });

  const id = uuidv4();
  const date = new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO net_worth_snapshots (id, user_id, date, total_assets, total_liabilities, net_worth, breakdown) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, date, totalAssets, totalLiabilities, totalAssets - totalLiabilities, JSON.stringify(breakdown));

  res.status(201).json({ success: true });
});

module.exports = router;
