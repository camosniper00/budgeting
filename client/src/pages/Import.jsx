import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [dragOver, setDragOver] = useState(false);

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

  function ColumnSelect({ value, onChange }) {
    return (
      <select
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">-- Select --</option>
        {preview?.headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Transactions</h1>

      {error && (
        <div className="bg-destructive/10 border-l-4 border-destructive text-destructive text-sm px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === STEPS.UPLOAD && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-1">Upload Bank Statement</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Supported formats: CSV, OFX, QFX. Download these from your bank&apos;s website.
            </p>

            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
              onClick={() => document.getElementById('file-input').click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
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
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mx-auto mb-3 text-muted-foreground">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="font-medium mb-1">
                {loading ? 'Parsing file...' : 'Drop your bank statement here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground">CSV, OFX, or QFX up to 10MB</p>
              <input id="file-input" type="file" accept=".csv,.ofx,.qfx" onChange={handleFileSelect} className="hidden" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping (CSV only) */}
      {step === STEPS.MAP && preview?.type === 'csv' && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-1">Map Columns</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Match your CSV columns to the correct fields. We&apos;ve auto-detected what we can.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="space-y-1.5">
                <Label>Date Column *</Label>
                <ColumnSelect value={mapping.date} onChange={v => setMapping(m => ({ ...m, date: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount Column *</Label>
                <ColumnSelect value={mapping.amount} onChange={v => setMapping(m => ({ ...m, amount: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description Column *</Label>
                <ColumnSelect value={mapping.description} onChange={v => setMapping(m => ({ ...m, description: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Merchant Column</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={mapping.merchant}
                  onChange={e => setMapping(m => ({ ...m, merchant: e.target.value }))}
                >
                  <option value="">(none)</option>
                  {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Type Column</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={mapping.type}
                  onChange={e => setMapping(m => ({ ...m, type: e.target.value }))}
                >
                  <option value="">(none - detect from amount sign)</option>
                  {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="signed"
                  checked={mapping.amount_is_signed}
                  onCheckedChange={v => setMapping(m => ({ ...m, amount_is_signed: v }))}
                />
                <Label htmlFor="signed" className="font-normal cursor-pointer">Amount is signed (negative = expense)</Label>
              </div>
            </div>

            {preview.sampleRows.length > 0 && (
              <div className="mb-5">
                <h4 className="font-medium mb-2 text-sm">Sample Data</h4>
                <div className="overflow-x-auto rounded-lg border text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {preview.headers.map(h => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {preview.headers.map(h => <td key={h} className="px-3 py-2">{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={reset}>Back</Button>
              <Button onClick={handleMapConfirm}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & Import */}
      {step === STEPS.PREVIEW && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-1">Preview &amp; Import</h3>
            <p className="text-sm text-muted-foreground mb-5">
              {preview.type === 'csv'
                ? `${preview.totalRows} transactions found. Showing sample below.`
                : `${preview.totalCount} transactions found. Showing up to 50 below.`}
            </p>

            <div className="mb-5 max-w-sm space-y-1.5">
              <Label>Import into Account *</Label>
              <Select value={String(selectedAccount)} onValueChange={setSelectedAccount}>
                <SelectTrigger><SelectValue placeholder="Select Account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border mb-5 text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Merchant</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTransactions.map((tx, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 whitespace-nowrap">{tx.date}</td>
                      <td className="px-3 py-2">{tx.description}</td>
                      <td className="px-3 py-2 text-muted-foreground">{tx.merchant || '-'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={tx.type === 'income' ? 'success' : 'destructive'} className="text-xs">
                          {tx.type}
                        </Badge>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { if (preview.type === 'csv') setStep(STEPS.MAP); else reset(); }}>Back</Button>
              <Button onClick={handleImport} disabled={loading || !selectedAccount}>
                {loading ? 'Importing...' : `Import ${preview.type === 'csv' ? preview.totalRows : preview.totalCount} Transactions`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {step === STEPS.RESULT && result && (
        <Card>
          <CardContent className="py-12 text-center">
            <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mx-auto mb-4 text-success">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className="text-xl font-bold mb-2">Import Complete</h2>
            <div className="text-muted-foreground mb-6">
              <p><strong className="text-foreground">{result.imported}</strong> transactions imported</p>
              {result.skipped > 0 && <p><strong className="text-foreground">{result.skipped}</strong> duplicates skipped</p>}
            </div>
            <Button onClick={reset}>Import Another File</Button>
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Import History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">File</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(h.created_at?.split(' ')[0] || h.created_at)}</td>
                      <td className="px-4 py-3">{h.filename}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{h.file_type.toUpperCase()}</Badge></td>
                      <td className="px-4 py-3">{h.account_name}</td>
                      <td className="px-4 py-3 text-right">{h.transaction_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
