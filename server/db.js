const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'budget.db');

let _sqlDb = null;
let _inTransaction = false;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('checking','savings','credit_card','loan','investment','cash','other')),
    balance REAL DEFAULT 0,
    institution TEXT,
    account_number_last4 TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
    icon TEXT,
    color TEXT,
    parent_id TEXT REFERENCES categories(id),
    is_system INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    merchant TEXT,
    date TEXT NOT NULL,
    notes TEXT,
    is_recurring INTEGER DEFAULT 0,
    transfer_account_id TEXT REFERENCES accounts(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    amount REAL NOT NULL,
    period TEXT NOT NULL CHECK(period IN ('monthly','weekly','yearly')),
    start_date TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    due_day INTEGER NOT NULL,
    frequency TEXT NOT NULL CHECK(frequency IN ('monthly','weekly','biweekly','yearly')),
    category_id TEXT REFERENCES categories(id),
    account_id TEXT REFERENCES accounts(id),
    is_autopay INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    next_due_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    target_date TEXT,
    icon TEXT,
    color TEXT DEFAULT '#4F46E5',
    is_completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    total_assets REAL NOT NULL,
    total_liabilities REAL NOT NULL,
    net_worth REAL NOT NULL,
    breakdown TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
  CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
`;

function saveSync() {
  if (!_sqlDb) return;
  const data = _sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// better-sqlite3-compatible wrapper around sql.js
const db = {
  async init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      _sqlDb = new SQL.Database(buffer);
    } else {
      _sqlDb = new SQL.Database();
    }
    _sqlDb.run('PRAGMA foreign_keys = ON');
    _sqlDb.exec(SCHEMA);
    saveSync();
    return db;
  },

  exec(sql) {
    _sqlDb.exec(sql);
    if (!_inTransaction) saveSync();
  },

  prepare(sql) {
    return {
      run(...params) {
        _sqlDb.run(sql, params);
        if (!_inTransaction) saveSync();
        return { changes: _sqlDb.getRowsModified() };
      },
      get(...params) {
        const stmt = _sqlDb.prepare(sql);
        if (params.length) stmt.bind(params);
        let result;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      all(...params) {
        const results = [];
        const stmt = _sqlDb.prepare(sql);
        if (params.length) stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
    };
  },

  transaction(fn) {
    return (...args) => {
      _sqlDb.run('BEGIN');
      _inTransaction = true;
      try {
        const result = fn(...args);
        _sqlDb.run('COMMIT');
        _inTransaction = false;
        saveSync();
        return result;
      } catch (e) {
        _sqlDb.run('ROLLBACK');
        _inTransaction = false;
        throw e;
      }
    };
  },

  pragma() {
    // handled in init()
  },

  saveSync,
};

module.exports = db;
