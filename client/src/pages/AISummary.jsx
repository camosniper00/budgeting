import { useState } from 'react';
import { api } from '../utils/api';

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

  // Simple markdown to HTML (handles ##, **, -, \n)
  function renderMarkdown(text) {
    if (!text) return '';
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3 style="margin-top:24px;margin-bottom:8px;font-size:1.125rem;font-weight:600;color:var(--text-primary)">${trimmed.slice(3)}</h3>`;
      } else if (trimmed.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h4 style="margin-top:16px;margin-bottom:4px;font-weight:600;color:var(--text-primary)">${trimmed.slice(4)}</h4>`;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) { html += '<ul style="margin:8px 0;padding-left:20px">'; inList = true; }
        html += `<li style="margin-bottom:4px;line-height:1.5">${formatInline(trimmed.slice(2))}</li>`;
      } else if (/^\d+\.\s/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p style="margin:4px 0;padding-left:8px;line-height:1.5">${formatInline(trimmed)}</p>`;
      } else if (trimmed === '') {
        if (inList) { html += '</ul>'; inList = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p style="margin:6px 0;line-height:1.6;color:var(--text-secondary)">${formatInline(trimmed)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }

  function formatInline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;font-size:0.875em">$1</code>')
      .replace(/\$([0-9,]+\.?\d*)/g, '<span style="font-weight:600;color:var(--color-primary)">$$$$1</span>');
  }

  return (
    <div>
      <div className="page-header">
        <h1>AI Financial Summary</h1>
        <button
          className="btn btn-primary"
          onClick={generateSummary}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{
                width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', display: 'inline-block',
              }} />
              Analyzing...
            </>
          ) : (
            <>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Generate Summary
            </>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {error && (
        <div className="card" style={{ background: '#FEF2F2', borderLeft: '4px solid var(--color-danger)', marginBottom: 20 }}>
          <p style={{ color: 'var(--color-danger)', margin: 0, fontWeight: 500 }}>{error}</p>
          {error.includes('ANTHROPIC_API_KEY') && (
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', fontSize: '0.875rem' }}>
              Set the ANTHROPIC_API_KEY environment variable before starting the server:<br/>
              <code style={{ background: 'white', padding: '2px 6px', borderRadius: 4 }}>
                ANTHROPIC_API_KEY=sk-ant-... npm run server
              </code>
            </p>
          )}
        </div>
      )}

      {!summary && !loading && !error && (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <svg width="64" height="64" fill="none" stroke="var(--text-muted)" strokeWidth="1" viewBox="0 0 24 24" style={{ marginBottom: 16 }}>
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h2 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>AI-Powered Financial Analysis</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Get a personalized summary of your financial health powered by Claude. The analysis includes
            spending patterns, budget tracking, goal progress, and actionable recommendations.
          </p>
          <button className="btn btn-primary" onClick={generateSummary} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Generate My Financial Summary
          </button>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{
            width: 48, height: 48, border: '3px solid var(--border-color)',
            borderTopColor: 'var(--color-primary)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
          }} />
          <h3 style={{ marginBottom: 8 }}>Analyzing your finances...</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Claude is reviewing your accounts, transactions, budgets, and goals.</p>
        </div>
      )}

      {summary && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: 0 }}>Financial Report</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Generated {new Date(summary.generatedAt).toLocaleString()} | Model: {summary.model} | Tokens: {summary.usage?.input_tokens + summary.usage?.output_tokens}
              </p>
            </div>
            <button className="btn btn-secondary" onClick={generateSummary} disabled={loading} style={{ fontSize: '0.8rem' }}>
              Regenerate
            </button>
          </div>
          <div
            className="ai-summary-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(summary.summary) }}
          />
        </div>
      )}
    </div>
  );
}
