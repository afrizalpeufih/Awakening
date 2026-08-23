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
