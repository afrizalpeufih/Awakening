import { useMemo } from 'react';
import type { DashboardData } from '../types';

// Helper to convert TS Name to URL-friendly slug
const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

type Props = {
  data: DashboardData;
};

export default function LandingPage({ data }: Props) {
  const allTsNames = useMemo(
    () => Array.from(new Set(data.seList.map((r) => r.tsName))).sort(),
    [data]
  );

  const handleTsClick = (tsName: string) => {
    const slug = slugify(tsName);
    window.location.href = `/${slug}`;
  };

  // Calculate aggregate metrics per territory
  const getTsMetrics = (tsName: string) => {
    const tsData = data.seList.filter((r) => r.tsName === tsName);
    const tsRetailers = data.retailers.filter((r) => r.tsName === tsName);
    
    const totalRetailers = tsData.reduce((sum, r) => sum + r.count, 0);
    
    // Use weighted average for OSA and SELLIN (matching DashboardView logic)
    const osaPct = tsData.reduce((sum, r) => sum + r.osaPct * r.count, 0) / (totalRetailers || 1);
    const sellinPct = tsData.reduce((sum, r) => sum + r.sellinPct * r.count, 0) / (totalRetailers || 1);
    
    // Use actual retailer count for biometrik (matching DashboardView logic)
    const biometrikCount = tsRetailers.filter((r) => r.bioMtd >= 1).length;
    const biometrikPct = totalRetailers ? (biometrikCount / totalRetailers) * 100 : 0;
    
    // Use actual incremental calculation (matching DashboardView logic)
    const totalIncremental = tsData.reduce((sum, r) => sum + r.incremental, 0);
    const incrementalPct = (totalIncremental / 40) * 100;

    return {
      totalRetailers,
      seCount: tsData.length,
      osaPct,
      sellinPct,
      biometrikPct,
      incrementalPct,
    };
  };

  const formatUpdateSource = (source: string | undefined) => {
    if (!source) return 'Unknown date';

    const cleanSource = source
      .replace(/\.[^/.]+$/, '')
      .replace(/^UPDATE[\s_-]+/i, '')
      .trim();

    const match = cleanSource.match(/^(\d{1,2})[\s_-]+([A-Za-z]+)[\s_-]+(\d{4})$/);

    if (!match) return cleanSource;

    const [, day, monthRaw, year] = match;
    const months: Record<string, string> = {
      JAN: 'January',
      JANUARI: 'January',
      JANUARY: 'January',
      FEB: 'February',
      FEBRUARI: 'February',
      FEBRUARY: 'February',
      MAR: 'March',
      MARET: 'March',
      MARCH: 'March',
      APR: 'April',
      APRIL: 'April',
      MEI: 'May',
      MAY: 'May',
      JUN: 'June',
      JUNI: 'June',
      JUNE: 'June',
      JUL: 'July',
      JULI: 'July',
      JULY: 'July',
      AGT: 'August',
      AGUS: 'August',
      AGUSTUS: 'August',
      AUG: 'August',
      AUGUST: 'August',
      SEP: 'September',
      SEPTEMBER: 'September',
      OKT: 'October',
      OKTOBER: 'October',
      OCT: 'October',
      OCTOBER: 'October',
      NOV: 'November',
      NOVEMBER: 'November',
      DES: 'December',
      DESEMBER: 'December',
      DEC: 'December',
      DECEMBER: 'December',
    };

    const month = months[monthRaw.toUpperCase()] ?? monthRaw;
    return `${Number(day)} ${month} ${year}`;
  };

  return (
    <div className="landing-page">
      <header className="landing-hero">
        <div className="hero-glow" />
        <div className="landing-hero-inner">
          <div className="landing-brand">
            <span className="brand-mark" aria-hidden="true">
              A
            </span>
            <h1 className="landing-title">AWAKENING Dashboard</h1>
            <p className="landing-subtitle">Pilih Territory untuk melihat dashboard</p>
            <p className="update-label">Update as of {formatUpdateSource(data.source)}</p>
          </div>
        </div>
      </header>

      <main className="landing-content">
        <div className="ts-grid">
          {allTsNames.map((tsName) => {
            const metrics = getTsMetrics(tsName);
            const totalRetailers = metrics.totalRetailers;

            return (
              <div key={tsName} className="ts-card">
                <div className="ts-card-header">
                  <h2 className="ts-card-title">{tsName}</h2>
                  <div className="ts-card-summary">
                    <span className="ts-summary-item">{metrics.seCount} DSE</span>
                    <span className="ts-summary-divider">·</span>
                    <span className="ts-summary-item">{totalRetailers} Outlets</span>
                  </div>
                </div>
                
                <div className="ts-card-body">
                  <div className="ts-metrics-grid">
                    <div className="ts-metric-row">
                      <span className="ts-metric-label">OSA</span>
                      <span className={`ts-metric-value ${metrics.osaPct >= 100 ? 'ts-metric-success' : ''}`}>
                        {metrics.osaPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="ts-metric-row">
                      <span className="ts-metric-label">SELLIN</span>
                      <span className={`ts-metric-value ${metrics.sellinPct >= 100 ? 'ts-metric-success' : ''}`}>
                        {metrics.sellinPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="ts-metric-row">
                      <span className="ts-metric-label">BIOMETRIK</span>
                      <span className={`ts-metric-value ${metrics.biometrikPct >= 100 ? 'ts-metric-success' : ''}`}>
                        {metrics.biometrikPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="ts-metric-row">
                      <span className="ts-metric-label">INCREMENTAL</span>
                      <span className={`ts-metric-value ${metrics.incrementalPct >= 100 ? 'ts-metric-success' : ''}`}>
                        {metrics.incrementalPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="ts-card-action"
                  onClick={() => handleTsClick(tsName)}
                >
                  Lihat Detail Dashboard →
                </button>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="landing-foot">
        Dibangun dengan Vite · React · TypeScript — siap deploy ke Vercel
      </footer>
    </div>
  );
}
