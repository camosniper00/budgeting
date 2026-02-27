const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

async function seed() {
  await db.init();

  // Clear existing data
  db.exec(`
    DELETE FROM net_worth_snapshots;
    DELETE FROM goals;
    DELETE FROM bills;
    DELETE FROM budgets;
    DELETE FROM transactions;
    DELETE FROM categories;
    DELETE FROM accounts;
    DELETE FROM users;
  `);

  // Create demo user
  const userId = uuidv4();
  const passwordHash = bcrypt.hashSync('demo123', 10);

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`)
    .run(userId, 'demo@budget.app', passwordHash, 'Demo User');

  // Create categories
  const categories = [
    // Income
    { name: 'Salary', type: 'income', icon: '💼', color: '#10B981' },
    { name: 'Freelance', type: 'income', icon: '💻', color: '#34D399' },
    { name: 'Investments', type: 'income', icon: '📈', color: '#6EE7B7' },
    { name: 'Other Income', type: 'income', icon: '💰', color: '#A7F3D0' },
    // Expenses
    { name: 'Housing', type: 'expense', icon: '🏠', color: '#EF4444' },
    { name: 'Transportation', type: 'expense', icon: '🚗', color: '#F97316' },
    { name: 'Food & Dining', type: 'expense', icon: '🍔', color: '#F59E0B' },
    { name: 'Groceries', type: 'expense', icon: '🛒', color: '#EAB308' },
    { name: 'Utilities', type: 'expense', icon: '💡', color: '#84CC16' },
    { name: 'Healthcare', type: 'expense', icon: '🏥', color: '#22C55E' },
    { name: 'Entertainment', type: 'expense', icon: '🎬', color: '#14B8A6' },
    { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#06B6D4' },
    { name: 'Personal Care', type: 'expense', icon: '💆', color: '#3B82F6' },
    { name: 'Education', type: 'expense', icon: '📚', color: '#6366F1' },
    { name: 'Insurance', type: 'expense', icon: '🛡️', color: '#8B5CF6' },
    { name: 'Subscriptions', type: 'expense', icon: '📱', color: '#A855F7' },
    { name: 'Travel', type: 'expense', icon: '✈️', color: '#D946EF' },
    { name: 'Gifts & Donations', type: 'expense', icon: '🎁', color: '#EC4899' },
    { name: 'Pets', type: 'expense', icon: '🐾', color: '#F43F5E' },
    { name: 'Miscellaneous', type: 'expense', icon: '📦', color: '#78716C' },
    // Transfer
    { name: 'Transfer', type: 'transfer', icon: '🔄', color: '#6B7280' },
  ];

  const categoryMap = {};
  const insertCategory = db.prepare(
    `INSERT INTO categories (id, user_id, name, type, icon, color, is_system) VALUES (?, ?, ?, ?, ?, ?, 1)`
  );

  for (const cat of categories) {
    const id = uuidv4();
    categoryMap[cat.name] = id;
    insertCategory.run(id, userId, cat.name, cat.type, cat.icon, cat.color);
  }

  // Create accounts
  const accountData = [
    { name: 'Main Checking', type: 'checking', balance: 4250.00, institution: 'Chase Bank', last4: '4523' },
    { name: 'Savings Account', type: 'savings', balance: 15800.00, institution: 'Chase Bank', last4: '8891' },
    { name: 'Visa Credit Card', type: 'credit_card', balance: -1340.50, institution: 'Capital One', last4: '3344' },
    { name: 'Car Loan', type: 'loan', balance: -12500.00, institution: 'Credit Union', last4: '7722' },
    { name: '401k', type: 'investment', balance: 45200.00, institution: 'Fidelity', last4: '9900' },
    { name: 'Brokerage', type: 'investment', balance: 8750.00, institution: 'Vanguard', last4: '5511' },
    { name: 'Cash', type: 'cash', balance: 180.00, institution: null, last4: null },
  ];

  const accountMap = {};
  const insertAccount = db.prepare(
    `INSERT INTO accounts (id, user_id, name, type, balance, institution, account_number_last4) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const acc of accountData) {
    const id = uuidv4();
    accountMap[acc.name] = id;
    insertAccount.run(id, userId, acc.name, acc.type, acc.balance, acc.institution, acc.last4);
  }

  // Generate transactions for the last 6 months
  const insertTransaction = db.prepare(
    `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount, description, merchant, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const now = new Date();
  const transactionTemplates = [
    { desc: 'Paycheck', merchant: 'Employer Inc.', cat: 'Salary', type: 'income', amount: 4500, account: 'Main Checking', day: 1 },
    { desc: 'Paycheck', merchant: 'Employer Inc.', cat: 'Salary', type: 'income', amount: 4500, account: 'Main Checking', day: 15 },
    { desc: 'Rent Payment', merchant: 'Landlord', cat: 'Housing', type: 'expense', amount: 1800, account: 'Main Checking', day: 1 },
    { desc: 'Electric Bill', merchant: 'Power Co', cat: 'Utilities', type: 'expense', amount: 95, account: 'Main Checking', day: 5 },
    { desc: 'Water Bill', merchant: 'City Water', cat: 'Utilities', type: 'expense', amount: 45, account: 'Main Checking', day: 8 },
    { desc: 'Internet', merchant: 'Xfinity', cat: 'Utilities', type: 'expense', amount: 75, account: 'Main Checking', day: 10 },
    { desc: 'Car Payment', merchant: 'Credit Union', cat: 'Transportation', type: 'expense', amount: 350, account: 'Main Checking', day: 12 },
    { desc: 'Car Insurance', merchant: 'GEICO', cat: 'Insurance', type: 'expense', amount: 120, account: 'Main Checking', day: 15 },
    { desc: 'Health Insurance', merchant: 'Blue Cross', cat: 'Insurance', type: 'expense', amount: 280, account: 'Main Checking', day: 1 },
    { desc: 'Netflix', merchant: 'Netflix', cat: 'Subscriptions', type: 'expense', amount: 15.99, account: 'Visa Credit Card', day: 7 },
    { desc: 'Spotify', merchant: 'Spotify', cat: 'Subscriptions', type: 'expense', amount: 10.99, account: 'Visa Credit Card', day: 12 },
    { desc: 'Gym Membership', merchant: 'Planet Fitness', cat: 'Personal Care', type: 'expense', amount: 25, account: 'Main Checking', day: 20 },
    { desc: 'Phone Bill', merchant: 'T-Mobile', cat: 'Utilities', type: 'expense', amount: 85, account: 'Main Checking', day: 18 },
  ];

  const variableTransactions = [
    { desc: 'Grocery Shopping', merchant: 'Whole Foods', cat: 'Groceries', type: 'expense', minAmt: 50, maxAmt: 180, account: 'Visa Credit Card' },
    { desc: 'Grocery Run', merchant: 'Trader Joe\'s', cat: 'Groceries', type: 'expense', minAmt: 30, maxAmt: 120, account: 'Visa Credit Card' },
    { desc: 'Gas Station', merchant: 'Shell', cat: 'Transportation', type: 'expense', minAmt: 35, maxAmt: 65, account: 'Visa Credit Card' },
    { desc: 'Restaurant', merchant: 'Various Restaurants', cat: 'Food & Dining', type: 'expense', minAmt: 15, maxAmt: 80, account: 'Visa Credit Card' },
    { desc: 'Coffee Shop', merchant: 'Starbucks', cat: 'Food & Dining', type: 'expense', minAmt: 4, maxAmt: 12, account: 'Visa Credit Card' },
    { desc: 'Amazon Purchase', merchant: 'Amazon', cat: 'Shopping', type: 'expense', minAmt: 15, maxAmt: 150, account: 'Visa Credit Card' },
    { desc: 'Target Shopping', merchant: 'Target', cat: 'Shopping', type: 'expense', minAmt: 20, maxAmt: 100, account: 'Visa Credit Card' },
    { desc: 'Movie Tickets', merchant: 'AMC Theaters', cat: 'Entertainment', type: 'expense', minAmt: 15, maxAmt: 40, account: 'Visa Credit Card' },
    { desc: 'Doctor Visit', merchant: 'City Medical', cat: 'Healthcare', type: 'expense', minAmt: 25, maxAmt: 150, account: 'Main Checking' },
    { desc: 'Pharmacy', merchant: 'CVS', cat: 'Healthcare', type: 'expense', minAmt: 10, maxAmt: 50, account: 'Visa Credit Card' },
    { desc: 'Freelance Payment', merchant: 'Client', cat: 'Freelance', type: 'income', minAmt: 200, maxAmt: 800, account: 'Main Checking' },
  ];

  function randomAmount(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  }

  function randomDay() {
    return Math.floor(Math.random() * 28) + 1;
  }

  const insertMany = db.transaction(() => {
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const month = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);

      for (const t of transactionTemplates) {
        const date = new Date(month.getFullYear(), month.getMonth(), t.day);
        if (date > now) continue;
        const dateStr = date.toISOString().split('T')[0];
        const variation = t.type === 'expense' ? randomAmount(0.9, 1.1) : 1;
        insertTransaction.run(
          uuidv4(), userId, accountMap[t.account], categoryMap[t.cat],
          t.type, Math.round(t.amount * variation * 100) / 100, t.desc, t.merchant, dateStr
        );
      }

      for (const t of variableTransactions) {
        const occurrences = t.cat === 'Groceries' ? Math.floor(Math.random() * 3) + 3 :
          t.cat === 'Food & Dining' ? Math.floor(Math.random() * 4) + 2 :
            Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < occurrences; i++) {
          const day = randomDay();
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          if (date > now) continue;
          const dateStr = date.toISOString().split('T')[0];
          const amount = randomAmount(t.minAmt, t.maxAmt);
          insertTransaction.run(
            uuidv4(), userId, accountMap[t.account], categoryMap[t.cat],
            t.type, amount, t.desc, t.merchant, dateStr
          );
        }
      }
    }
  });

  insertMany();

  // Create budgets
  const budgetData = [
    { cat: 'Housing', amount: 1850, period: 'monthly' },
    { cat: 'Transportation', amount: 500, period: 'monthly' },
    { cat: 'Food & Dining', amount: 400, period: 'monthly' },
    { cat: 'Groceries', amount: 600, period: 'monthly' },
    { cat: 'Utilities', amount: 350, period: 'monthly' },
    { cat: 'Entertainment', amount: 150, period: 'monthly' },
    { cat: 'Shopping', amount: 300, period: 'monthly' },
    { cat: 'Healthcare', amount: 200, period: 'monthly' },
    { cat: 'Subscriptions', amount: 60, period: 'monthly' },
    { cat: 'Personal Care', amount: 100, period: 'monthly' },
    { cat: 'Insurance', amount: 450, period: 'monthly' },
    { cat: 'Miscellaneous', amount: 200, period: 'monthly' },
  ];

  const insertBudget = db.prepare(
    `INSERT INTO budgets (id, user_id, category_id, amount, period, start_date) VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const b of budgetData) {
    insertBudget.run(uuidv4(), userId, categoryMap[b.cat], b.amount, b.period, '2025-01-01');
  }

  // Create bills
  const billData = [
    { name: 'Rent', amount: 1800, dueDay: 1, freq: 'monthly', cat: 'Housing', account: 'Main Checking', autopay: 0 },
    { name: 'Electric', amount: 95, dueDay: 5, freq: 'monthly', cat: 'Utilities', account: 'Main Checking', autopay: 1 },
    { name: 'Water', amount: 45, dueDay: 8, freq: 'monthly', cat: 'Utilities', account: 'Main Checking', autopay: 1 },
    { name: 'Internet', amount: 75, dueDay: 10, freq: 'monthly', cat: 'Utilities', account: 'Main Checking', autopay: 1 },
    { name: 'Car Payment', amount: 350, dueDay: 12, freq: 'monthly', cat: 'Transportation', account: 'Main Checking', autopay: 1 },
    { name: 'Car Insurance', amount: 120, dueDay: 15, freq: 'monthly', cat: 'Insurance', account: 'Main Checking', autopay: 1 },
    { name: 'Health Insurance', amount: 280, dueDay: 1, freq: 'monthly', cat: 'Insurance', account: 'Main Checking', autopay: 1 },
    { name: 'Phone', amount: 85, dueDay: 18, freq: 'monthly', cat: 'Utilities', account: 'Main Checking', autopay: 1 },
    { name: 'Gym', amount: 25, dueDay: 20, freq: 'monthly', cat: 'Personal Care', account: 'Main Checking', autopay: 1 },
    { name: 'Netflix', amount: 15.99, dueDay: 7, freq: 'monthly', cat: 'Subscriptions', account: 'Visa Credit Card', autopay: 1 },
    { name: 'Spotify', amount: 10.99, dueDay: 12, freq: 'monthly', cat: 'Subscriptions', account: 'Visa Credit Card', autopay: 1 },
  ];

  const insertBill = db.prepare(
    `INSERT INTO bills (id, user_id, name, amount, due_day, frequency, category_id, account_id, is_autopay, next_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const b of billData) {
    const nextDue = new Date(now.getFullYear(), now.getMonth(), b.dueDay);
    if (nextDue < now) nextDue.setMonth(nextDue.getMonth() + 1);
    insertBill.run(uuidv4(), userId, b.name, b.amount, b.dueDay, b.freq, categoryMap[b.cat], accountMap[b.account], b.autopay, nextDue.toISOString().split('T')[0]);
  }

  // Create goals
  const goalData = [
    { name: 'Emergency Fund', target: 20000, current: 15800, date: '2025-12-31', icon: '🛡️', color: '#10B981' },
    { name: 'Vacation Fund', target: 5000, current: 1200, date: '2025-08-01', icon: '✈️', color: '#3B82F6' },
    { name: 'New Laptop', target: 2000, current: 750, date: '2025-06-01', icon: '💻', color: '#8B5CF6' },
    { name: 'Wedding Fund', target: 30000, current: 4500, date: '2026-10-01', icon: '💒', color: '#EC4899' },
  ];

  const insertGoal = db.prepare(
    `INSERT INTO goals (id, user_id, name, target_amount, current_amount, target_date, icon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const g of goalData) {
    insertGoal.run(uuidv4(), userId, g.name, g.target, g.current, g.date, g.icon, g.color);
  }

  // Create net worth snapshots for last 6 months
  const insertSnapshot = db.prepare(
    `INSERT INTO net_worth_snapshots (id, user_id, date, total_assets, total_liabilities, net_worth, breakdown) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const growth = (5 - i) * 0.02;
    const assets = 74180 * (1 + growth);
    const liabilities = 13840.50 * (1 - growth * 0.3);
    insertSnapshot.run(
      uuidv4(), userId, date.toISOString().split('T')[0],
      Math.round(assets * 100) / 100,
      Math.round(liabilities * 100) / 100,
      Math.round((assets - liabilities) * 100) / 100,
      JSON.stringify({
        checking: 4250 * (1 + growth * 0.5),
        savings: 15800 * (1 + growth),
        investments: 53950 * (1 + growth * 1.5),
        credit_card: -1340.50,
        car_loan: -12500 * (1 - growth * 0.3),
      })
    );
  }

  db.saveSync();
  console.log('Database seeded successfully!');
  console.log('Demo login: demo@budget.app / demo123');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
