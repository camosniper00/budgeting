const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { encryptAccount, decryptAccount } = require('../utils/encryption');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY type, name').all(req.userId)
    .map(a => decryptAccount(a, req.encryptionKey));
  res.json(accounts);
});

router.get('/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(decryptAccount(account, req.encryptionKey));
});

router.post('/', (req, res) => {
  const { name, type, balance, institution, account_number_last4 } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  const id = uuidv4();
  const encrypted = encryptAccount({ institution, account_number_last4 }, req.encryptionKey);
  db.prepare('INSERT INTO accounts (id, user_id, name, type, balance, institution, account_number_last4) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, name, type, balance || 0, encrypted.institution, encrypted.account_number_last4);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  res.status(201).json(decryptAccount(account, req.encryptionKey));
});

router.put('/:id', (req, res) => {
  const { name, type, balance, institution, account_number_last4, is_active } = req.body;
  const encrypted = encryptAccount({ institution, account_number_last4 }, req.encryptionKey);
  db.prepare(`UPDATE accounts SET
    name = COALESCE(?, name),
    type = COALESCE(?, type),
    balance = COALESCE(?, balance),
    institution = COALESCE(?, institution),
    account_number_last4 = COALESCE(?, account_number_last4),
    is_active = COALESCE(?, is_active),
    updated_at = datetime('now')
    WHERE id = ? AND user_id = ?`)
    .run(name, type, balance, encrypted.institution, encrypted.account_number_last4, is_active, req.params.id, req.userId);

  const account = db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  res.json(decryptAccount(account, req.encryptionKey));
});

router.delete('/:id', (req, res) => {
  const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?').get(req.params.id);
  if (txCount.count > 0) {
    db.prepare('UPDATE accounts SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.userId);
  } else {
    db.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  }
  res.json({ success: true });
});

module.exports = router;
