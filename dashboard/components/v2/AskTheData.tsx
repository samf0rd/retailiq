'use client';

import { useState } from 'react';

/**
 * "Ask the data" (PRD §6.4) — the one AI surface that stays interactive
 * rather than pre-rendered. Backed by api/ask.py, which only ever answers
 * from pre-computed mart summaries (never free-form SQL, never an invented
 * number) and cites which mart(s) it drew from. An honest "can't answer
 * from what's here" is a valid, expected response, not an error state.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

const EXAMPLE_QUESTIONS = [
  'What is total revenue and how many orders?',
  'How concentrated is revenue in the top categories?',
  'How does the top decile of sellers compare on late delivery?',
];

interface AskResponse {
  answer: string;
  can_answer: boolean;
  used_pages: string[];
  sources: string[];
  source: 'ai' | 'unavailable';
}

export default function AskTheData() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rq-panel"
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--line-subtle)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s-6)',
        boxShadow: 'var(--shadow-panel)',
      }}
    >
      <div style={{ marginBottom: 'var(--s-4)' }}>
        <div className="rq-eyebrow" style={{ marginBottom: 'var(--s-1)' }}>
          Ask the data
        </div>
        <div style={{ color: 'var(--text-hi)', fontSize: 'var(--t-h2)', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Ask a question, grounded in the marts
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        style={{ display: 'flex', gap: 'var(--s-2)' }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. how concentrated is revenue in the top categories?"
          style={{
            flex: 1,
            background: 'var(--bg-inset)',
            border: '1px solid var(--line-subtle)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-2) var(--s-3)',
            color: 'var(--text-hi)',
            fontSize: 'var(--t-sm)',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            background: 'var(--accent-wash)',
            border: '1px solid var(--line-accent)',
            borderRadius: 'var(--r-md)',
            padding: '0 var(--s-4)',
            color: 'var(--accent)',
            fontSize: 'var(--t-sm)',
            fontWeight: 500,
            cursor: loading || !question.trim() ? 'default' : 'pointer',
            opacity: loading || !question.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }}>
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuestion(q);
              submit(q);
            }}
            style={{
              background: 'none',
              border: '1px solid var(--line-subtle)',
              borderRadius: 'var(--r-sm)',
              padding: '3px 8px',
              color: 'var(--text-lo)',
              fontSize: 'var(--t-cap)',
              cursor: 'pointer',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ marginTop: 'var(--s-4)', fontSize: 'var(--t-sm)', color: 'var(--neg)' }}>{error}</p>
      )}

      {result && (
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--line-subtle)',
            borderLeft: `2px solid ${result.can_answer ? 'var(--line-accent)' : 'var(--text-faint)'}`,
            borderRadius: 'var(--r-md)',
            padding: 'var(--s-4) var(--s-5)',
            marginTop: 'var(--s-4)',
          }}
        >
          <p style={{ color: result.can_answer ? 'var(--text-mid)' : 'var(--text-lo)', fontSize: 'var(--t-sm)', maxWidth: '70ch' }}>
            {result.answer}
          </p>
          {result.can_answer && result.sources.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--s-1)', flexWrap: 'wrap', marginTop: 'var(--s-3)' }}>
              {result.sources.map((s) => (
                <span
                  key={s}
                  className="rq-mono"
                  style={{
                    fontSize: 'var(--t-cap)',
                    color: 'var(--text-lo)',
                    border: '1px solid var(--line-subtle)',
                    borderRadius: 'var(--r-sm)',
                    padding: '1px 6px',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
