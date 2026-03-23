const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default;
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { decryptTransaction, decryptAccount } = require('../utils/encryption');

const router = express.Router();
router.use(authenticate);

function getFinancialData(userId, encryptionKey) {
  const now = new Date();

  // Current month
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curStart = `${curMonth}-01`;
  const curEnd = `${curMonth}-31`;

  // Previous month
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevStart = `${prevMonth}-01`;
  const prevEnd = `${prevMonth}-31`;

  // Accounts
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id = ? AND is_active = 1').all(userId)
    .map(a => decryptAccount(a, encryptionKey));
  const totalAssets = accounts.filter(a => !['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => ['credit_card', 'loan'].includes(a.type)).reduce((s, a) => s + Math.abs(a.balance), 0);

  // Current month income/expenses
  const curIncome = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?`).get(userId, curStart, curEnd);
  const curExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`).get(userId, curStart, curEnd);

  // Previous month income/expenses
  const prevIncome = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?`).get(userId, prevStart, prevEnd);
  const prevExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`).get(userId, prevStart, prevEnd);

  // Spending by category (current month)
  const spendingByCategory = db.prepare(`
    SELECT c.name, SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id ORDER BY total DESC
  `).all(userId, curStart, curEnd);

  // Previous month spending by category
  const prevSpendingByCategory = db.prepare(`
    SELECT c.name, SUM(t.amount) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    GROUP BY c.id ORDER BY total DESC
  `).all(userId, prevStart, prevEnd);

  // Budget vs actual
  const budgets = db.prepare(`
    SELECT b.amount as budgeted, c.name as category_name,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.category_id = b.category_id AND t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?), 0) as spent
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.user_id = ? AND b.is_active = 1
  `).all(userId, curStart, curEnd, userId);

  // Upcoming bills
  const bills = db.prepare(`
    SELECT b.name, b.amount, b.due_day, b.frequency, b.is_autopay
    FROM bills b
    WHERE b.user_id = ? AND b.is_active = 1
    ORDER BY b.due_day
  `).all(userId);

  // Goals
  const goals = db.prepare('SELECT name, target_amount, current_amount, target_date FROM goals WHERE user_id = ? AND is_completed = 0').all(userId);

  // Monthly trend (last 6 months)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mStart = `${mStr}-01`;
    const mEnd = `${mStr}-31`;
    const inc = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ?`).get(userId, mStart, mEnd);
    const exp = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`).get(userId, mStart, mEnd);
    monthlyTrend.push({ month: mStr, income: inc.total, expenses: exp.total, savings: Math.round((inc.total - exp.total) * 100) / 100 });
  }

  // Recent large transactions (top 5 this month)
  const largeTransactions = db.prepare(`
    SELECT t.amount, t.description, t.type, t.date, c.name as category
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
    ORDER BY t.amount DESC LIMIT 5
  `).all(userId, curStart, curEnd).map(tx => ({
    ...tx,
    description: decryptTransaction(tx, encryptionKey).description,
  }));

  return {
    currentMonth: curMonth,
    previousMonth: prevMonth,
    netWorth: Math.round((totalAssets - totalLiabilities) * 100) / 100,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
    currentMonthIncome: curIncome.total,
    currentMonthExpenses: curExpenses.total,
    currentMonthSavings: Math.round((curIncome.total - curExpenses.total) * 100) / 100,
    previousMonthIncome: prevIncome.total,
    previousMonthExpenses: prevExpenses.total,
    previousMonthSavings: Math.round((prevIncome.total - prevExpenses.total) * 100) / 100,
    spendingByCategory,
    prevSpendingByCategory,
    budgets,
    bills,
    goals,
    monthlyTrend,
    largeTransactions,
  };
}

router.post('/', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set. Add it to your server environment to enable AI summaries.' });
  }

  try {
    const data = getFinancialData(req.userId, req.encryptionKey);

    const client = new Anthropic({ apiKey });

    const financialContext = JSON.stringify(data, null, 2);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      thinking: { type: 'enabled', budget_tokens: 1024 },
      system: `You are a personal financial advisor analyzing a user's budget data. Provide a clear, actionable financial summary report. Use plain language. Format your response in markdown with these sections:

## Financial Health Snapshot
A brief 2-3 sentence overview of their overall financial position.

## Monthly Performance
Compare this month vs last month - income, expenses, savings rate. Highlight improvements or concerns.

## Spending Analysis
Identify top spending categories, any unusual spikes, and categories where they're over/under budget.

## Bills & Obligations
Summarize upcoming bills and total monthly obligations.

## Goals Progress
How their savings goals are tracking and estimated completion dates.

## Recommendations
3-5 specific, actionable suggestions to improve their financial health based on the data.

Be encouraging but honest. Use dollar amounts. If data is sparse or missing, note it and focus on what's available.`,
      messages: [
        {
          role: 'user',
          content: `Here is my financial data. Please generate a comprehensive financial summary report:\n\n${financialContext}`,
        },
      ],
    });

    let summary = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        summary += block.text;
      }
    }

    res.json({
      summary,
      generatedAt: new Date().toISOString(),
      model: response.model,
      usage: response.usage,
    });
  } catch (err) {
    if (err.status === 401) {
      return res.status(401).json({ error: 'Invalid Anthropic API key. Check your ANTHROPIC_API_KEY environment variable.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Anthropic API. Please try again in a moment.' });
    }
    res.status(500).json({ error: `Failed to generate summary: ${err.message}` });
  }
});

module.exports = router;
