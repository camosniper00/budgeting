import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
];

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'loan', label: 'Loan' },
  { value: 'other', label: 'Other' },
];

const STEPS = ['Welcome', 'Currency', 'Account', 'Done'];

export default function Setup() {
  const { user, completeSetup } = useAuth();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [accountBalance, setAccountBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    setError('');
    setLoading(true);
    try {
      if (step === 1) {
        await api.put('/auth/me', { currency });
      } else if (step === 2) {
        if (!accountName.trim()) {
          setError('Please enter an account name');
          setLoading(false);
          return;
        }
        await api.post('/accounts', {
          name: accountName.trim(),
          type: accountType,
          balance: parseFloat(accountBalance) || 0,
          institution: institution.trim() || undefined,
        });
      } else if (step === 3) {
        await completeSetup();
        return;
      }
      setStep(s => s + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipAccount() {
    setError('');
    setLoading(true);
    try {
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#4F46E5"/>
              <circle cx="16" cy="16" r="6" fill="white" fillOpacity="0.9"/>
              <path d="M14 14h4v4h-4z" fill="#4F46E5"/>
            </svg>
          </div>
          {step === 0 && (
            <>
              <CardTitle className="text-2xl">Welcome to BudgetMint!</CardTitle>
              <CardDescription>
                Hi {user?.name}! Let's get your account set up in just a few steps.
              </CardDescription>
            </>
          )}
          {step === 1 && (
            <>
              <CardTitle className="text-xl">Choose Your Currency</CardTitle>
              <CardDescription>Select the primary currency for your budgets and transactions.</CardDescription>
            </>
          )}
          {step === 2 && (
            <>
              <CardTitle className="text-xl">Add Your First Account</CardTitle>
              <CardDescription>Add a bank account, credit card, or wallet to start tracking.</CardDescription>
            </>
          )}
          {step === 3 && (
            <>
              <CardTitle className="text-xl">You're All Set!</CardTitle>
              <CardDescription>Your account is ready. Start tracking your finances.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-3 py-2.5 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`} />
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 transition-colors ${
                    i < step ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Here's what we'll do:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Pick your preferred currency</li>
                  <li>Add your first financial account</li>
                </ul>
                <p>This only takes a minute.</p>
              </div>
              <Button onClick={handleNext} className="w-full" disabled={loading}>
                Get Started
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleNext} className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Continue'}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder="e.g. Main Checking"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account Type</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="balance">Current Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={accountBalance}
                  onChange={e => setAccountBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="institution">Bank / Institution (optional)</Label>
                <Input
                  id="institution"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  placeholder="e.g. Chase, Wells Fargo"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleSkipAccount} className="flex-1" disabled={loading}>
                  Skip
                </Button>
                <Button onClick={handleNext} className="flex-1" disabled={loading}>
                  {loading ? 'Adding...' : 'Add Account'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>You can now:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Add transactions to track spending</li>
                  <li>Set up budgets for your categories</li>
                  <li>Import bank statements (CSV or OFX)</li>
                  <li>Track bills and savings goals</li>
                </ul>
              </div>
              <Button onClick={handleNext} className="w-full" disabled={loading}>
                {loading ? 'Finishing...' : 'Go to Dashboard'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
