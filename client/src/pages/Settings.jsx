import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ICONS = ['📦', '🏠', '🚗', '🍔', '🛒', '💡', '🏥', '🎬', '🛍️', '💆', '📚', '🛡️', '📱', '✈️', '🎁', '🐾', '💼', '💻', '📈', '💰'];

export default function Settings() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [categories, setCategories] = useState([]);
  const [saved, setSaved] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', icon: '📦', color: '#6B7280' });

  useEffect(() => {
    api.get('/categories').then(setCategories);
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    await api.put('/auth/me', { name, currency });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    await api.post('/categories', catForm);
    setCatModalOpen(false);
    api.get('/categories').then(setCategories);
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category? Transactions using it will become uncategorized.')) return;
    try {
      await api.delete(`/categories/${id}`);
      api.get('/categories').then(setCategories);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                    <SelectItem value="AUD">AUD ($)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit">Save Changes</Button>
                {saved && <span className="text-sm text-success font-medium">Saved!</span>}
              </div>
            </form>

            <Separator className="my-5" />
            <div>
              <p className="text-sm font-semibold text-destructive mb-3">Danger Zone</p>
              <Button variant="destructive" onClick={logout}>Log Out</Button>
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Categories</CardTitle>
              <Button
                size="sm"
                onClick={() => { setCatForm({ name: '', type: 'expense', icon: '📦', color: '#6B7280' }); setCatModalOpen(true); }}
              >
                + Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto space-y-4">
              {['income', 'expense', 'transfer'].map(type => {
                const typeCats = categories.filter(c => c.type === type);
                if (typeCats.length === 0) return null;
                return (
                  <div key={type}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{type}</p>
                    <div className="space-y-0">
                      {typeCats.map((cat, i) => (
                        <div key={cat.id}>
                          <div className="flex justify-between items-center py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                              <span className="text-sm">{cat.icon} {cat.name}</span>
                            </div>
                            {!cat.is_system && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCategory(cat.id)}
                              >
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </Button>
                            )}
                          </div>
                          {i < typeCats.length - 1 && <Separator />}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={catModalOpen} onOpenChange={open => !open && setCatModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category Name</Label>
              <Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={catForm.type} onValueChange={v => setCatForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex gap-1.5 flex-wrap">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setCatForm(f => ({ ...f, icon }))}
                    className={cn(
                      'w-8 h-8 rounded-md text-base flex items-center justify-center border-2 transition-colors',
                      catForm.icon === icon ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <input
                type="color"
                value={catForm.color}
                onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                className="h-9 w-full rounded-md border border-input cursor-pointer p-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCatModalOpen(false)}>Cancel</Button>
              <Button type="submit">Add Category</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
