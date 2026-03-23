import { useState } from 'react';
import { api } from '../utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Simple markdown renderer
function renderMarkdown(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 class="text-base font-semibold mt-6 mb-2">${trimmed.slice(3)}</h3>`;
    } else if (trimmed.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h4 class="font-semibold mt-4 mb-1">${trimmed.slice(4)}</h4>`;
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) { html += '<ul class="my-2 pl-5 space-y-1">'; inList = true; }
      html += `<li class="leading-relaxed">${formatInline(trimmed.slice(2))}</li>`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p class="my-1 pl-2 leading-relaxed">${formatInline(trimmed)}</p>`;
    } else if (trimmed === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p class="my-1.5 leading-relaxed text-muted-foreground">${formatInline(trimmed)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[0.875em]">$1</code>')
    .replace(/\$([0-9,]+\.?\d*)/g, '<span class="font-semibold text-primary">$$$1</span>');
}

const SparkleIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function AISummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateSummary() {
    setLoading(true);
    setError('');
    setSummary(null);

    try {
      const data = await api.post('/ai-summary');
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Financial Summary</h1>
        <Button onClick={generateSummary} disabled={loading} className="gap-2">
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Analyzing...
            </>
          ) : (
            <><SparkleIcon /> Generate Summary</>
          )}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-destructive font-medium text-sm">{error}</p>
            {error.includes('ANTHROPIC_API_KEY') && (
              <p className="text-muted-foreground text-sm mt-2">
                Set the ANTHROPIC_API_KEY environment variable before starting the server:{' '}
                <code className="bg-background px-1.5 py-0.5 rounded text-xs border">
                  ANTHROPIC_API_KEY=sk-ant-... npm run server
                </code>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!summary && !loading && !error && (
        <Card>
          <CardContent className="py-16 text-center">
            <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24" className="mx-auto mb-4 text-muted-foreground/50">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2 className="text-xl font-bold mb-2">AI-Powered Financial Analysis</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
              Get a personalized summary of your financial health powered by Claude. The analysis includes
              spending patterns, budget tracking, goal progress, and actionable recommendations.
            </p>
            <Button onClick={generateSummary} className="gap-2">
              <SparkleIcon /> Generate My Financial Summary
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <svg className="animate-spin h-12 w-12 mx-auto mb-5 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <h3 className="font-semibold mb-2">Analyzing your finances...</h3>
            <p className="text-muted-foreground text-sm">Claude is reviewing your accounts, transactions, budgets, and goals.</p>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Financial Report</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Generated {new Date(summary.generatedAt).toLocaleString()} · {summary.model} · {(summary.usage?.input_tokens + summary.usage?.output_tokens).toLocaleString()} tokens
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={generateSummary} disabled={loading}>
                Regenerate
              </Button>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <div
              className="prose-sm text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(summary.summary) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
