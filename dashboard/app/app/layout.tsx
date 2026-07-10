import Rail from '@/components/Rail';
import { TourProvider } from '@/components/TourProvider';

/**
 * Dashboard shell (PRD §3) — Rail nav + TourProvider, scoped to '/app/*'
 * only. The public landing page at '/' (app/page.tsx) is a sibling route,
 * not a child of this layout, so it never gets this chrome.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Rail />
        <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1400 }}>{children}</main>
      </div>
    </TourProvider>
  );
}
