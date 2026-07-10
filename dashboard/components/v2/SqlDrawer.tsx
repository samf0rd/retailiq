'use client';

import { useEffect, useRef, useState } from 'react';
import { MODELS } from '@/lib/models';
import { ModelDetail } from './ModelDetail';

/**
 * <SqlDrawer> (PRD §5.5) — the SQL showcase surface. Triggered by a small
 * "</> View SQL" button in a Panel's corner (see ViewSqlTrigger below,
 * which owns both the button and this drawer so any Panel — v1 or v2
 * token system — can use it without itself becoming a client component).
 *
 * Self-contained token scope: everything the drawer renders is wrapped in
 * .rq-v2 internally, so it always renders correctly regardless of which
 * page/token-system its trigger button lives in (PRD's v2 primitives only
 * resolve inside that scope, see styles/tokens.css's scoping note).
 *
 * The actual content (SQL, lineage, tests) lives in <ModelDetail> — shared
 * with the Methodology page's node-click panel (§7.2), so this file only
 * owns the drawer chrome: scrim, slide-in, focus trap, Esc-to-close.
 */
function SqlDrawer({ modelName, onClose }: { modelName: string; onClose: () => void }) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    drawerRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!MODELS[modelName]) return null;

  return (
    <div className="rq-v2">
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(5, 7, 10, 0.55)', zIndex: 40 }}
      />
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`SQL for ${modelName}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 560,
          maxWidth: '92vw',
          background: 'var(--bg-inset)',
          borderLeft: '1px solid var(--line-strong)',
          boxShadow: 'var(--shadow-pop)',
          zIndex: 50,
          padding: 'var(--s-6)',
          overflowY: 'auto',
          animation: `rq-drawer-in var(--dur-base) var(--ease-out) both`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 'var(--s-5)', right: 'var(--s-5)', background: 'none', border: 'none', color: 'var(--text-lo)', cursor: 'pointer', fontSize: 18 }}
        >
          ✕
        </button>
        <ModelDetail modelName={modelName} showMethodologyLink />
      </aside>
    </div>
  );
}

export function ViewSqlTrigger({ modelName, style, id }: { modelName: string; style?: React.CSSProperties; id?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  if (!MODELS[modelName]) return null;

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="rq-mono"
        style={{
          fontSize: 11,
          color: 'var(--text-lo, var(--text-dim))',
          cursor: 'pointer',
          border: '1px solid var(--line-subtle, var(--border))',
          padding: '3px 8px',
          borderRadius: 6,
          background: 'none',
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        {'</>'} View SQL
      </button>
      {open && <SqlDrawer modelName={modelName} onClose={close} />}
    </>
  );
}
