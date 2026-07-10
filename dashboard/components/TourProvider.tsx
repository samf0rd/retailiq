'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Tour, { TourStep } from '@/components/Tour';

const TOUR_SEEN_KEY = 'retailiq_tour_seen';

// One real DOM element per step (ids on Rail.tsx, the Exec Summary
// AnalystNote block, and its "View SQL" trigger). All five only ever
// coexist on Exec Summary ('/app') — see the design note below — so the
// tour never needs to navigate mid-flight between steps.
//
// Retargeted for v2 (PRD §9.3): step 3 now describes the describe-only
// AnalystNote pattern (§6.1) instead of the old "AI-grounded finding" —
// that framing described the Key-Finding card this revamp deleted. Step 4
// is new: it targets a real <SqlDrawer> trigger, tying the tour to the
// revamp's headline feature (every number's query is one click away)
// instead of a generic panel click-through.
const TOUR_STEPS: TourStep[] = [
  {
    target: 'tour-rail-wordmark',
    body: 'This dashboard runs on real Olist marketplace data — 98,699 valid orders, 2016–2018, 74 categories. Not synthetic.',
  },
  {
    target: 'tour-rail-nav',
    body: 'Six areas of analysis, each answering a different business question — revenue, retention, segments, sellers, logistics.',
  },
  {
    target: 'tour-decision-card',
    body: 'Every page opens with an AnalystNote — it describes what the numbers below it show, grounded in real data, and never makes a decision. Judgment lives separately, hand-authored and tagged "Author: analysis."',
  },
  {
    target: 'tour-sql-drawer',
    body: 'Every number here has its query one click away — View SQL opens the real dbt model behind this panel, its lineage, and its tests.',
  },
  {
    target: 'tour-about-button',
    body: 'Come back here anytime for the full data & methodology writeup. Tour complete!',
  },
];

interface TourContextValue {
  startTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

/**
 * Owns the tour's active/inactive state so it can be triggered from
 * multiple, unrelated places in the tree (the Exec Summary slim banner's
 * "Take a tour" link, and the About modal's "Replay tour" button) without
 * prop drilling. Lives in the root layout, alongside <Rail/> and
 * {children}, so it survives client-side navigation.
 *
 * DESIGN NOTE — why the tour only ever runs from Exec Summary:
 * Step 4 spotlights the "Top Categories" panel, which only exists on
 * Exec Summary (Revenue's filter dropdowns were the original candidate,
 * but Exec Summary itself has no filter UI — see REDESIGN discussion).
 * Rather than navigate the user mid-tour between steps (fragile: has to
 * pause the overlay, wait for route transition + new page hydration,
 * resume — a lot of moving parts for marginal benefit), startTour()
 * navigates to '/app' FIRST if needed, then starts the tour only once
 * that landing is confirmed. Navigation only ever happens before step 1,
 * never between steps.
 *
 * Lives in the dashboard's own nested layout (app/app/layout.tsx), not the
 * root layout — the tour targets dashboard-only DOM (Rail, decision cards),
 * none of which exists on the public landing page at '/' (PRD §9.1), so
 * there's no reason for this provider (or its localStorage auto-trigger
 * effect below) to run outside '/app/*' at all.
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);

  const startTour = useCallback(() => {
    if (pathname !== '/app') {
      setPendingStart(true);
      router.push('/app');
    } else {
      setActive(true);
    }
  }, [pathname, router]);

  // Resume a tour start requested from another page, once navigation has
  // landed on '/app' and that page's content (DecisionCard, Top Categories)
  // has had a moment to mount.
  useEffect(() => {
    if (pendingStart && pathname === '/app') {
      setPendingStart(false);
      const t = setTimeout(() => setActive(true), 150);
      return () => clearTimeout(t);
    }
  }, [pendingStart, pathname]);

  // Auto-trigger once for a first-time visitor, only when they're actually
  // on Exec Summary (checked on every pathname change, not just mount, so
  // a visitor who lands on e.g. /app/logistics first still gets it if they
  // later navigate to '/app' — the localStorage flag is what actually
  // prevents repeat triggers, not the dependency array).
  useEffect(() => {
    if (pathname === '/app' && typeof window !== 'undefined' && window.localStorage.getItem(TOUR_SEEN_KEY) !== 'true') {
      const t = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  function close() {
    setActive(false);
    window.localStorage.setItem(TOUR_SEEN_KEY, 'true');
  }

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {active && <Tour steps={TOUR_STEPS} onClose={close} />}
    </TourContext.Provider>
  );
}
