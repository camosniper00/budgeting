import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/Modal';

const STEPS = { UPLOAD: 0, MAP: 1, PREVIEW: 2, RESULT: 3 };

export default function Import() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({ date: '', amount: '', description: '', merchant: '', type: '', amount_is_signed: true });
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get('/accounts').then(setAccounts);
    api.get('/import/history').then(setHistory);
  }, []);

  async function handleFileSelect(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setLoading(true);

    try {
      const data = await api.upload('/import/preview', f);
      setPreview(data);

      if (data.type === 'csv') {
        // Auto-detect column mapping
        const headers = data.headers;
        const autoMap = { date: '', amount: '', description: '', merchant: '', type: '', amount_is_signed: true };
        for (const h of headers) {
          const lower = h.toLowerCase();
          if (!autoMap.date && (lower.includes('date') || lower === 'posted')) autoMap.date = h;
          if (!autoMap.amount && (lower.includes('amount') || lower.includes('sum') || lower === 'debit')) autoMap.amount = h;
          if (!autoMap.description && (lower.includes('desc') || lower.includes('memo') || lower.includes('narr') || lower.includes('detail'))) autoMap.description = h;
          if (!autoMap.merchant && (lower.includes('merchant') || lower.includes('payee') || lower.includes('name'))) autoMap.merchant = h;
          if (!autoMap.type && (lower.includes('type') || lower.includes('category'))) autoMap.type = h;
        }
        setMapping(autoMap);
        setStep(STEPS.MAP);
      } else {
        // OFX/QFX - go straight to preview
        setParsedTransactions(data.transactions);
        setStep(STEPS.PREVIEW);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMapConfirm() {
    if (!mapping.date || !mapping.amount || !mapping.description) {
      setError('Date, Amount, and Description columns are required');
      return;
    }
    // Re-parse with mapping to show preview
    const transactions = [];
    for (const row of preview.sampleRows) {
      const dateVal = row[mapping.date];
      const amountVal = row[mapping.amount];
      if (!dateVal || !amountVal) continue;
      const amount = parseFloat(amountVal.replace(/[^0-9.\-]/g, ''));
      if (isNaN(amount)) continue;

      let type = 'expense';
      if (mapping.amount_is_signed) {
        type = amount >= 0 ? 'income' : 'expense';
      }

      transactions.push({
        date: dateVal,
        amount: Math.abs(amount),
        type,
        description: row[mapping.description] || '',
        merchant: mapping.merchant ? row[mapping.merchant] : null,
      });
    }
    setParsedTransactions(transactions);
    setStep(STEPS.PREVIEW);
  }

  async function handleImport() {
    if (!selectedAccount) {
      setError('Please select an account');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const extraFields = { account_id: selectedAccount };
      if (preview.type === 'csv') {
        extraFields.mapping = mapping;
      }
      const data = await api.upload('/import', file, extraFields);
      setResult(data);
      setStep(STEPS.RESULT);
      // Refresh history
      api.get('/import/history').then(setHistory);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setStep(STEPS.UPLOAD);
    setPreview(null);
    setMapping({ date: '', amount: '', description: '', merchant: '', type: '', amount_is_signed: true });
    setParsedTransactions([]);
    setResult(null);
    setError('');
  }

  return (
    <div>
      <div className="page-header">
        <h1>Import Transactions</h1>
      </div>

      {error && (
        <div className="card" style={{ background: '#FEF2F2', borderLeft: '4px solid var(--color-danger)', marginBottom: 20 }}>
          <p style={{ color: 'var(--color-danger)', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === STEPS.UPLOAD && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Upload Bank Statement</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
            Supported formats: CSV, OFX, QFX. Download these from your bank's website.
          </p>

          <div style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
          }}
            onClick={() => document.getElementById('file-input').click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'var(--border-color)';
              const f = e.dataTransfer.files[0];
              if (f) {
                const input = document.getElementById('file-input');
                const dt = new DataTransfer();
                dt.items.add(f);
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }}
          >
            <svg width="48" height="48" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12 }}>
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ fontWeight: 500, marginBottom: 4 }}>
              {loading ? 'Parsing file...' : 'Drop your bank statement here or click to browse'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>CSV, OFX, or QFX up to 10MB</p>
            <input id="file-input" type="file" accept=".csv,.ofx,.qfx" onChange={handleFileSelect} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping (CSV only) */}
      {step === STEPS.MAP && preview?.type === 'csv' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Map Columns</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
            Match your CSV columns to the correct fields. We've auto-detected what we can.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="form-group">
              <label>Date Column *</label>
              <select className="form-control" value={mapping.date} onChange={e => setMapping(m => ({ ...m, date: e.target.value }))}>
                <option value="">-- Select --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount Column *</label>
              <select className="form-control" value={mapping.amount} onChange={e => setMapping(m => ({ ...m, amount: e.target.value }))}>
                <option value="">-- Select --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description Column *</label>
              <select className="form-control" value={mapping.description} onChange={e => setMapping(m => ({ ...m, description: e.target.value }))}>
                <option value="">-- Select --</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Merchant Column</label>
              <select className="form-control" value={mapping.merchant} onChange={e => setMapping(m => ({ ...m, merchant: e.target.value }))}>
                <option value="">(none)</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type Column</label>
              <select className="form-control" value={mapping.type} onChange={e => setMapping(m => ({ ...m, type: e.target.value }))}>
                <option value="">(none - detect from amount sign)</option>
                {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
              <input type="checkbox" id="signed" checked={mapping.amount_is_signed} onChange={e => setMapping(m => ({ ...m, amount_is_signed: e.target.checked }))} />
              <label htmlFor="signed" style={{ margin: 0 }}>Amount is signed (negative = expense)</label>
            </div>
          </div>

          {preview.sampleRows.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ marginBottom: 8 }}>Sample Data</h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>{preview.headers.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, i) => (
                      <tr key={i}>{preview.headers.map(h => <td key={h}>{row[h]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={reset}>Back</button>
            <button className="btn btn-primary" onClick={handleMapConfirm}>Continue</button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & Import */}
      {step === STEPS.PREVIEW && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Preview & Import</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
            {preview.type === 'csv'
              ? `${preview.totalRows} transactions found. Showing sample below.`
              : `${preview.totalCount} transactions found. Showing up to 50 below.`}
          </p>

          <div className="form-group" style={{ marginBottom: 20, maxWidth: 400 }}>
            <label>Import into Account *</label>
            <select className="form-control" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
              <option value="">-- Select Account --</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
            </select>
          </div>

          <div className="table-container" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Merchant</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsedTransactions.map((tx, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td>{tx.description}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.merchant || '-'}</td>
                    <td>
                      <span className="badge" style={{
                        background: tx.type === 'income' ? '#DCFCE7' : '#FEE2E2',
                        color: tx.type === 'income' ? '#166534' : '#991B1B',
                      }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: tx.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => {
              if (preview.type === 'csv') setStep(STEPS.MAP);
              else reset();
            }}>Back</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={loading || !selectedAccount}>
              {loading ? 'Importing...' : `Import ${preview.type === 'csv' ? preview.totalRows : preview.totalCount} Transactions`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === STEPS.RESULT && result && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 40 }}>
          <svg width="64" height="64" fill="none" stroke="var(--color-success)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h2 style={{ marginBottom: 8 }}>Import Complete</h2>
          <div style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
            <p><strong>{result.imported}</strong> transactions imported</p>
            {result.skipped > 0 && <p><strong>{result.skipped}</strong> duplicates skipped</p>}
          </div>
          <button className="btn btn-primary" onClick={reset}>Import Another File</button>
        </div>
      )}

      {/* Import History */}
      {history.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Import History</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>File</th>
                  <th>Type</th>
                  <th>Account</th>
                  <th style={{ textAlign: 'right' }}>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(h.created_at?.split(' ')[0] || h.created_at)}</td>
                    <td>{h.filename}</td>
                    <td><span className="badge">{h.file_type.toUpperCase()}</span></td>
                    <td>{h.account_name}</td>
                    <td style={{ textAlign: 'right' }}>{h.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
