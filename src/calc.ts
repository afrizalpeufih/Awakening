import type { DashboardData } from './types';

export function pctColor(pct: number): string {
    if (pct >= 75) return 'var(--ok)';
    if (pct >= 50) return 'var(--warn)';
    return 'var(--bad)';
}

export function fmtNum(n: number): string {
    return n.toLocaleString('id-ID');
}

export function fmtPct(n: number): string {
    return n.toFixed(1) + '%';
}

/** Indonesian month names (incl. common abbreviations) -> English month name */
export const MONTH_MAP: Record<string, string> = {
    JAN: 'January', JANUARI: 'January', JANUARY: 'January',
    FEB: 'February', FEBRUARI: 'February', FEBRUARY: 'February',
    MAR: 'March', MARET: 'March', MARCH: 'March',
    APR: 'April', APRIL: 'April',
    MEI: 'May', MAY: 'May',
    JUN: 'June', JUNI: 'June', JUNE: 'June',
    JUL: 'July', JULI: 'July', JULY: 'July',
    AGT: 'August', AGUS: 'August', AGUSTUS: 'August', AUG: 'August', AUGUST: 'August',
    SEP: 'September', SEPTEMBER: 'September',
    OKT: 'October', OKTOBER: 'October', OCT: 'October', OCTOBER: 'October',
    NOV: 'November', NOVEMBER: 'November',
    DES: 'December', DESEMBER: 'December', DEC: 'December', DECEMBER: 'December',
};

/** Convert a name to a URL-friendly slug */
export const slugify = (text: string): string =>
    text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

/** Month name (Indonesian/English incl. abbreviations) -> 0-based month index */
const MONTH_INDEX: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

/**
 * Parse a comparable timestamp (ms) from a file name / source label.
 * Handles formats like "20 Agustus 2026.xlsx", "UPDATE 31 JULI.xlsx",
 * or "Update data : 18 August 2026". Returns null if no date is found.
 */
export function parseFileDate(sourceOrLabel?: string | null): number | null {
    if (!sourceOrLabel) return null;
    const clean = sourceOrLabel.replace(/\.[^/.]+$/, '').trim();
    const m = clean.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const monthRaw = m[2].toUpperCase();
    const monthEng = MONTH_MAP[monthRaw];
    if (!monthEng) return null;
    const monthIdx = MONTH_INDEX[monthEng];
    if (monthIdx === undefined) return null;
    const year = m[3] ? parseInt(m[3], 10) : 2026;
    return new Date(year, monthIdx, day).getTime();
}

/**
 * Hitung persentase 4 KPI card (OSA, SELLIN, BIOMETRIK, INCREMENTAL)
 * untuk dataset tertentu pada territory & SE terpilih.
 * Rumus identik dengan perhitungan view totals di App.tsx.
 */
export function computeMetricPcts(
    data: DashboardData,
    tsName: string,
    seName?: string
): { osa: number; sellin: number; bio: number; inc: number } {
    const seRows = data.seList.filter((r) => r.tsName === tsName);
    const retailers = data.retailers.filter((r) => r.tsName === tsName);

    // Filter per-SE (jika dipilih): retailers milik SE tsb, target dari row SE tsb
    const scopedRetailers = seName && seName !== 'AWAKENING'
        ? retailers.filter((r) => r.seName === seName)
        : retailers;
    const scopedSeRows = seName && seName !== 'AWAKENING'
        ? seRows.filter((r) => r.seName === seName)
        : seRows;

    const totalRetailers = scopedRetailers.length;

    const osaMtd = scopedRetailers.reduce((s, r) => s + r.osaMtd, 0);
    const targetOsa = scopedSeRows.reduce((s, r) => s + r.targetOsa, 0);
    const osaPct = targetOsa > 0 ? (osaMtd / targetOsa) * 100 : 0;

    const sellinMtd = scopedRetailers.reduce((s, r) => s + r.sellinMtd, 0);
    const targetSellin = scopedSeRows.reduce((s, r) => s + r.targetSellin, 0);
    const sellinPct = targetSellin > 0 ? (sellinMtd / targetSellin) * 100 : 0;

    const bioGt1 = scopedRetailers.filter((r) => r.bioMtd > 1).length;
    const bioPct = totalRetailers > 0 ? (bioGt1 / totalRetailers) * 100 : 0;

    const incremental = scopedSeRows.reduce((s, r) => s + r.incremental, 0);
    const targetIncremental = scopedSeRows.reduce((s, r) => s + (r.targetIncremental || 40), 0);
    const incPct = targetIncremental > 0 ? (incremental / targetIncremental) * 100 : 0;

    return { osa: osaPct, sellin: sellinPct, bio: bioPct, inc: incPct };
}
