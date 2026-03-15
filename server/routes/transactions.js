const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { encryptTransaction, decryptTransaction } = require('../utils/encryption');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { account_id, category_id, type, start_date, end_date, search, limit, offset, sort } = req.query;

  let query = `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.user_id = ?`;
  const params = [req.userId];

  if (account_id) { query += ' AND t.account_id = ?'; params.push(account_id); }
  if (category_id) { query += ' AND t.category_id = ?'; params.push(category_id); }
  if (type) { query += ' AND t.type = ?'; params.push(type); }
  if (start_date) { query += ' AND t.date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND t.date <= ?'; params.push(end_date); }
  if (search) { query += ' AND (t.description LIKE ? OR t.merchant LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const sortOrder = sort === 'oldest' ? 'ASC' : 'DESC';
  query += ` ORDER BY t.date ${sortOrder}, t.created_at ${sortOrder}`;

  if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }
  if (offset) { query += ' OFFSET ?'; params.push(parseInt(offset)); }

  const transactions = db.prepare(query).all(...params).map(tx => decryptTransaction(tx, req.encryptionKey));

  // Get total count for pagination
  let countQuery = `SELECT COUNT(*) as total FROM transactions t WHERE t.user_id = ?`;
  const countParams = [req.userId];
  if (account_id) { countQuery += ' AND t.account_id = ?'; countParams.push(account_id); }
  if (category_id) { countQuery += ' AND t.category_id = ?'; countParams.push(category_id); }
  if (type) { countQuery += ' AND t.type = ?'; countParams.push(type); }
  if (start_date) { countQuery += ' AND t.date >= ?'; countParams.push(start_date); }
  if (end_date) { countQuery += ' AND t.date <= ?'; countParams.push(end_date); }
  if (search) { countQuery += ' AND (t.description LIKE ? OR t.merchant LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`); }

  const { total } = db.prepare(countQuery).get(...countParams);

  res.json({ transactions, total });
});

router.post('/', (req, res) => {
  const { account_id, category_id, type, amount, description, merchant, date, notes, is_recurring, transfer_account_id } = req.body;
  if (!account_id || !type || !amount || !description || !date) {
    return res.status(400).json({ error: 'account_id, type, amount, description, and date are required' });
  }

  const id = uuidv4();
  const encrypted = encryptTransaction({ description, merchant, notes }, req.encryptionKey);
  db.prepare(`INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, description, merchant, date, notes, is_recurring, transfer_account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, req.userId, account_id, category_id, type, amount, encrypted.description, encrypted.merchant, date, encrypted.notes, is_recurring ? 1 : 0, transfer_account_id);

  // Update account balance
  if (type === 'expense') {
    db.prepare('UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?').run(amount, account_id);
  } else if (type === 'income') {
    db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?').run(amount, account_id);
  } else if (type === 'transfer' && transfer_account_id) {
    db.prepare('UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ?').run(amount, account_id);
    db.prepare('UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?').run(amount, transfer_account_id);
  }

  const transaction = db.prepare(`SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?`).get(id);
  res.status(201).json(decryptTransaction(transaction, req.encryptionKey));
});

router.put('/:id', (req, res) => {
  const { account_id, category_id, type, amount, description, merchant, date, notes } = req.body;
  const encrypted = encryptTransaction({ description, merchant, notes }, req.encryptionKey);
  db.prepare(`UPDATE transactions SET
    account_id = COALESCE(?, account_id),
    category_id = COALESCE(?, category_id),
    type = COALESCE(?, type),
    amount = COALESCE(?, amount),
    description = COALESCE(?, description),
    merchant = COALESCE(?, merchant),
    date = COALESCE(?, date),
    notes = COALESCE(?, notes),
    updated_at = datetime('now')
    WHERE id = ? AND user_id = ?`)
    .run(account_id, category_id, type, amount, encrypted.description, encrypted.merchant, date, encrypted.notes, req.params.id, req.userId);

  const transaction = db.prepare(`SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?`).get(req.params.id);
  res.json(decryptTransaction(transaction, req.encryptionKey));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ success: true });
});

module.exports = router;
