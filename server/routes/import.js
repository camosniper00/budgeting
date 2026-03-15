const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const ofx = require('ofx-js');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { encryptTransaction } = require('../utils/encryption');

const router = express.Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.csv') || ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, OFX, and QFX files are supported'));
    }
  },
});

function computeHash(date, amount, description) {
  return crypto.createHash('sha256')
    .update(`${date}|${amount}|${description}`)
    .digest('hex');
}

function parseOFXData(content) {
  return ofx.parse(content).then(data => {
    const transactions = [];
    const stmt = data?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS
      || data?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS;

    if (!stmt) return transactions;

    const txList = stmt.BANKTRANLIST?.STMTTRN || [];
    const txArray = Array.isArray(txList) ? txList : [txList];

    for (const tx of txArray) {
      if (!tx) continue;
      const amount = parseFloat(tx.TRNAMT);
      const dateStr = tx.DTPOSTED?.substring(0, 8);
      const date = dateStr
        ? `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
        : new Date().toISOString().split('T')[0];

      transactions.push({
        date,
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
        description: tx.NAME || tx.MEMO || 'Unknown',
        merchant: tx.NAME || null,
        fitid: tx.FITID || null,
      });
    }

    return transactions;
  });
}

function parseCSVData(content, mapping) {
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const transactions = [];
  for (const row of records) {
    const dateVal = row[mapping.date];
    const amountVal = row[mapping.amount];
    const descVal = row[mapping.description] || '';

    if (!dateVal || !amountVal) continue;

    // Parse amount - remove currency symbols, commas
    const cleanAmount = amountVal.replace(/[^0-9.\-]/g, '');
    const amount = parseFloat(cleanAmount);
    if (isNaN(amount)) continue;

    // Determine type from amount or dedicated column
    let type = 'expense';
    if (mapping.type && row[mapping.type]) {
      const typeVal = row[mapping.type].toLowerCase();
      if (typeVal.includes('income') || typeVal.includes('credit') || typeVal.includes('deposit')) {
        type = 'income';
      }
    } else if (amount > 0 && mapping.amount_is_signed) {
      type = 'income';
    }

    // Parse date - handle common formats
    const date = parseDate(dateVal);
    if (!date) continue;

    transactions.push({
      date,
      amount: Math.abs(amount),
      type: mapping.amount_is_signed ? (amount >= 0 ? 'income' : 'expense') : type,
      description: descVal,
      merchant: mapping.merchant ? (row[mapping.merchant] || null) : null,
    });
  }

  return transactions;
}

function parseDate(str) {
  if (!str) return null;
  // Try ISO format first (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  // MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  }
  // DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  // Fallback: try native Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// Preview parsed file (returns headers for CSV, parsed transactions for OFX/QFX)
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const filename = req.file.originalname.toLowerCase();

    if (filename.endsWith('.csv')) {
      // For CSV, return headers so frontend can build column mapping
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        to: 5,
      });

      const headers = records.length > 0 ? Object.keys(records[0]) : [];
      res.json({
        type: 'csv',
        headers,
        sampleRows: records.slice(0, 5),
        totalRows: content.split('\n').length - 1,
      });
    } else {
      // OFX/QFX - parse directly
      const transactions = await parseOFXData(content);
      res.json({
        type: filename.endsWith('.qfx') ? 'qfx' : 'ofx',
        transactions: transactions.slice(0, 50),
        totalCount: transactions.length,
      });
    }
  } catch (err) {
    res.status(400).json({ error: `Failed to parse file: ${err.message}` });
  }
});

// Import transactions from file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { account_id, mapping } = req.body;
    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    // Verify account belongs to user
    const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(account_id, req.userId);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const content = req.file.buffer.toString('utf-8');
    const filename = req.file.originalname.toLowerCase();
    let transactions;

    if (filename.endsWith('.csv')) {
      const columnMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
      if (!columnMapping?.date || !columnMapping?.amount || !columnMapping?.description) {
        return res.status(400).json({ error: 'CSV mapping requires date, amount, and description columns' });
      }
      transactions = parseCSVData(content, columnMapping);
    } else {
      transactions = await parseOFXData(content);
    }

    if (transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions found in file' });
    }

    // Import with duplicate detection
    const importId = uuidv4();
    let imported = 0;
    let skipped = 0;

    const insertTx = db.transaction((txList) => {
      for (const tx of txList) {
        const hash = computeHash(tx.date, tx.amount, tx.description);

        // Check for duplicate
        const existing = db.prepare(
          'SELECT id FROM transactions WHERE user_id = ? AND account_id = ? AND import_hash = ?'
        ).get(req.userId, account_id, hash);

        if (existing) {
          skipped++;
          continue;
        }

        const id = uuidv4();
        const encrypted = encryptTransaction(
          { description: tx.description, merchant: tx.merchant, notes: null },
          req.encryptionKey
        );

        db.prepare(`INSERT INTO transactions (id, user_id, account_id, type, amount, description, merchant, date, import_hash, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, req.userId, account_id, tx.type, tx.amount, encrypted.description, encrypted.merchant, tx.date, hash, 'import');

        // Update account balance
        if (tx.type === 'expense') {
          db.prepare("UPDATE accounts SET balance = balance - ?, updated_at = datetime('now') WHERE id = ?").run(tx.amount, account_id);
        } else if (tx.type === 'income') {
          db.prepare("UPDATE accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?").run(tx.amount, account_id);
        }

        imported++;
      }
    });

    insertTx(transactions);

    // Record the import
    const fileType = filename.endsWith('.csv') ? 'csv' : filename.endsWith('.qfx') ? 'qfx' : 'ofx';
    db.prepare('INSERT INTO imports (id, user_id, filename, file_type, account_id, transaction_count) VALUES (?, ?, ?, ?, ?, ?)')
      .run(importId, req.userId, req.file.originalname, fileType, account_id, imported);

    res.json({
      success: true,
      imported,
      skipped,
      total: transactions.length,
      importId,
    });
  } catch (err) {
    res.status(400).json({ error: `Import failed: ${err.message}` });
  }
});

// Get import history
router.get('/history', (req, res) => {
  const imports = db.prepare(`
    SELECT i.*, a.name as account_name
    FROM imports i
    LEFT JOIN accounts a ON i.account_id = a.id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all(req.userId);
  res.json(imports);
});

module.exports = router;
