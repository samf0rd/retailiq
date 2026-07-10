import PageHeader from '@/components/PageHeader';
import Panel from '@/components/Panel';
import WarehouseNotice from '@/components/WarehouseNotice';
import SellersFilters from '@/components/SellersFilters';
import SellersTable from '@/components/SellersTable';
import SellersQuadrantScatter from '@/components/SellersQuadrantScatter';
import AnalystNote from '@/components/v2/AnalystNote';
import Recommendation from '@/components/v2/Recommendation';
import { apiGet, ApiError, SellerRow } from '@/lib/api';
import { fmtBRL } from '@/lib/format';

export const dynamic = 'force-dynamic';

// This page's own /api/sellers call is capped at the top 100 by revenue (see
// below) — these platform-wide figures span all 3,095 sellers and were
// verified directly against main_marts.mart_sellers rather than requiring a
// second, uncapped fetch just to compute four numbers. Same "verified once,
// hardcoded" convention as api/commentary.py's FALLBACK_FINDINGS.
const PLATFORM_SELLERS = {
  totalSellers: 3095,
  topDecileCount: 311,
  topDecileRevenue: 10588476.29,
  totalGmv: 15843553.24,
  lateAmongTopDecileCount: 55,
  lateAmongTopDecileRevenue: 1559269.91,
};

export default async function SellersPage({ searchParams }: { searchParams: { tier?: string } }) {
  const tier = searchParams.tier || undefined;

  let rows: SellerRow[] = [];
  let error: string | null = null;

  try {
    rows = await apiGet<SellerRow[]>('/api/sellers', { tier, limit: 100 });
  } catch (e) {
    error = e instanceof ApiError ? e.message : 'Unknown error';
  }

  if (error) {
    return (
      <>
        <PageHeader eyebrow="SELLERS" title="Seller Performance" />
        <WarehouseNotice error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="SELLERS"
        title="Seller Performance"
        subtitle={`Ranked by gross revenue. Tier combines revenue percentile and review quality. Top ${
          tier ? `100 ${tier} tier` : '100'
        } sellers shown. Click a row to expand delivery and category detail.`}
      />

      <div className="rq-v2" style={{ marginBottom: 20 }}>
        <AnalystNote
          figures={{
            topDecileCount: PLATFORM_SELLERS.topDecileCount,
            totalSellers: PLATFORM_SELLERS.totalSellers,
            gmvShare: ((PLATFORM_SELLERS.topDecileRevenue / PLATFORM_SELLERS.totalGmv) * 100).toFixed(1),
            lateCount: PLATFORM_SELLERS.lateAmongTopDecileCount,
          }}
        >
          {(f) => (
            <>
              The top decile of sellers by revenue (
              <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                {f.topDecileCount}
              </span>{' '}
              of{' '}
              <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                {f.totalSellers.toLocaleString()}
              </span>
              ) generates{' '}
              <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                {f.gmvShare}%
              </span>{' '}
              of total GMV. Within that top decile,{' '}
              <span className="rq-mono" style={{ color: 'var(--text-hi)' }}>
                {f.lateCount}
              </span>{' '}
              sellers run a late-delivery rate above 10%.
            </>
          )}
        </AnalystNote>
        <Recommendation
          takeaway={`Fix onboarding for ${PLATFORM_SELLERS.lateAmongTopDecileCount} top-decile sellers → protects ${fmtBRL(PLATFORM_SELLERS.lateAmongTopDecileRevenue)} of at-risk GMV.`}
        >
          <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
            {PLATFORM_SELLERS.lateAmongTopDecileCount}
          </span>{' '}
          of the platform&apos;s{' '}
          <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
            {PLATFORM_SELLERS.topDecileCount}
          </span>{' '}
          highest-revenue sellers exceed a 10% late-delivery rate, carrying{' '}
          <span className="rq-mono" style={{ color: 'var(--accent-hi)' }}>
            {fmtBRL(PLATFORM_SELLERS.lateAmongTopDecileRevenue)}
          </span>{' '}
          of GMV at elevated delivery risk. An onboarding-standards fix targeted at just these{' '}
          {PLATFORM_SELLERS.lateAmongTopDecileCount} sellers protects that revenue without touching the other{' '}
          {PLATFORM_SELLERS.totalSellers - PLATFORM_SELLERS.topDecileCount} lower-revenue sellers — a quantified,
          targeted intervention instead of an untargeted platform-wide quality push.
        </Recommendation>
      </div>

      <Panel title="Revenue vs Review Score — quadrant view, tier-colored" sqlModel="mart_sellers" style={{ marginBottom: 16 }}>
        <SellersQuadrantScatter data={rows} />
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
          Dashed lines mark the median across these {rows.length} sellers. Revenue axis is log-scaled — seller
          revenue is heavily right-skewed even within this top slice.
        </p>
      </Panel>

      <SellersFilters />

      <Panel title="Seller Scorecard" sqlModel="mart_sellers">
        <SellersTable rows={rows} />
      </Panel>
    </>
  );
}
