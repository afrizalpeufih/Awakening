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
    AGU: 'August', AGT: 'August', AGUS: 'August', AGUSTUS: 'August', AUG: 'August', AUGUST: 'August',
    SEP: 'September', SEPTEMBER: 'September',
    OKT: 'October', OKTOBER: 'October', OCT: 'October', OCTOBER: 'October',
    NOV: 'November', NOVEMBER: 'November', NOP: 'November', NOPEMBER: 'November',
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
 * Mengecek apakah retailer memiliki incremental >= 20% (Bio LMTD vs Bio MTD):
 * - Jika Bio LMTD = 0 dan Bio MTD > 0: dihitung incremental (tumbuh dari 0).
 * - Jika Bio LMTD > 0: dihitung incremental jika pertumbuhan ((Bio MTD - Bio LMTD) / Bio LMTD) >= 0.20 (20%).
 */
export function isIncremental20(bioLmtd: number, bioMtd: number): boolean {
    if (bioLmtd === 0) return bioMtd > 0;
    return (bioMtd - bioLmtd) / bioLmtd >= 0.20;
}

/**
 * Menghitung persentase pertumbuhan Incremental (Bio LMTD vs Bio MTD) untuk retailer:
 * - Jika Bio MTD <= Bio LMTD (0 atau minus): 0%
 * - Jika Bio LMTD = 0 dan Bio MTD > 0: 100%
 * - Jika Bio LMTD > 0 dan Bio MTD > Bio LMTD: ((Bio MTD - Bio LMTD) / Bio LMTD) * 100%
 */
export function calcIncrementalPct(bioLmtd: number, bioMtd: number): string {
    if (bioMtd <= bioLmtd) return '0%';
    if (bioLmtd === 0) return '100%';
    const pct = ((bioMtd - bioLmtd) / bioLmtd) * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/**
 * Daftar hari libur nasional Indonesia (format "YYYY-MM-DD")
 */
export const NATIONAL_HOLIDAYS: Set<string> = new Set([
    // 2025
    '2025-01-01', '2025-01-27', '2025-01-29', '2025-03-29', '2025-03-31', '2025-04-01',
    '2025-04-18', '2025-05-01', '2025-05-12', '2025-05-29', '2025-06-01', '2025-06-07',
    '2025-06-27', '2025-08-17', '2025-09-05', '2025-12-25',
    // 2026
    '2026-01-01', // Tahun Baru 2026 Masehi
    '2026-01-16', // Isra Mikraj Nabi Muhammad SAW
    '2026-02-17', // Tahun Baru Imlek 2577 Kongzili
    '2026-03-19', // Hari Suci Nyepi (Tahun Baru Saka 1948)
    '2026-03-21', // Hari Raya Idul Fitri 1447 H
    '2026-03-22', // Hari Raya Idul Fitri 1447 H
    '2026-04-03', // Wafat Yesus Kristus
    '2026-05-01', // Hari Buruh Internasional
    '2026-05-14', // Kenaikan Yesus Kristus
    '2026-05-27', // Hari Raya Idul Adha 1447 H
    '2026-05-31', // Hari Raya Waisak 2570
    '2026-06-01', // Hari Lahir Pancasila
    '2026-06-16', // Tahun Baru Islam 1448 H
    '2026-08-17', // Proklamasi Kemerdekaan
    '2026-08-25', // Maulid Nabi Muhammad SAW
    '2026-12-25', // Kelahiran Yesus Kristus (Natal)
]);

export const HOLIDAYS_2026 = NATIONAL_HOLIDAYS;

/**
 * Mengecek apakah tanggal tertentu merupakan hari kerja:
 * - Hari Minggu (getDay() === 0): BUKAN hari kerja
 * - Hari Libur Nasional: BUKAN hari kerja
 * - Hari Senin-Sabtu: Hari kerja
 */
export function isWorkingDay(year: number, monthIdx: number, day: number): boolean {
    const dt = new Date(year, monthIdx, day);
    if (dt.getDay() === 0) return false;
    const mStr = String(monthIdx + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${mStr}-${dStr}`;
    if (NATIONAL_HOLIDAYS.has(dateKey)) return false;
    return true;
}

/**
 * Menghitung total hari kerja dari tanggal 1 s/d cutoffDay dalam bulan & tahun tertentu
 */
export function countWorkingDays(year: number, monthIdx: number, cutoffDay: number): number {
    let count = 0;
    const maxDay = Math.min(Math.max(1, cutoffDay), 31);
    for (let d = 1; d <= maxDay; d++) {
        if (isWorkingDay(year, monthIdx, d)) {
            count++;
        }
    }
    return Math.max(1, count);
}

/**
 * Parse tanggal, bulan, dan tahun dari nama file / label sumber data
 */
export function parseDateInfo(sourceOrLabel?: string | null): { day: number; monthIdx: number; year: number } {
    const defaultRes = { day: 31, monthIdx: 10, year: 2026 };
    if (!sourceOrLabel) return defaultRes;
    const clean = sourceOrLabel.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
    const m = clean.match(/(?:UPDATE\s+|Update\s+data\s*:\s*)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/i);
    if (!m) return defaultRes;
    const day = parseInt(m[1], 10);
    const monthRaw = m[2].toUpperCase();
    const monthEng = MONTH_MAP[monthRaw];
    const monthIdx = monthEng && MONTH_INDEX[monthEng] !== undefined ? MONTH_INDEX[monthEng] : defaultRes.monthIdx;
    const year = m[3] ? parseInt(m[3], 10) : defaultRes.year;
    return { day: day >= 1 && day <= 31 ? day : 31, monthIdx, year };
}

/**
 * Hitung rata-rata EC harian untuk seorang SE berdasarkan total EC dibagi hari kerja
 */
export function calcSeEcAvg(total?: number, workingDays?: number): number {
    const days = workingDays && workingDays > 0 ? workingDays : 1;
    return (total || 0) / days;
}

/**
 * Format angka 1 desimal dengan koma (misal: 70,8 atau 55,9)
 */
export function fmtAvg(val: number): string {
    if (!val || isNaN(val) || val <= 0) return '0,0';
    return val.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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


    const osaMtd = scopedRetailers.reduce((s, r) => s + r.osaMtd, 0);
    const targetOsa = scopedSeRows.reduce((s, r) => s + r.targetOsa, 0);
    const osaPct = targetOsa > 0 ? (osaMtd / targetOsa) * 100 : 0;

    const sellinMtd = scopedRetailers.reduce((s, r) => s + r.sellinMtd, 0);
    const targetSellin = scopedSeRows.reduce((s, r) => s + r.targetSellin, 0);
    const sellinPct = targetSellin > 0 ? (sellinMtd / targetSellin) * 100 : 0;

    const grossAdAchieve = scopedRetailers.reduce((s, r) => s + r.bioMtd, 0);
    const targetGrossAd = scopedSeRows.reduce((s, r) => s + (r.targetGrossAd ?? r.targetSellin), 0);
    const bioPct = targetGrossAd > 0 ? (grossAdAchieve / targetGrossAd) * 100 : 0;

    const totalRetailers = scopedRetailers.length;
    const incrementalRetailers = scopedRetailers.filter((r) => isIncremental20(r.bioLmtd, r.bioMtd)).length;
    const incPct = totalRetailers > 0 ? (incrementalRetailers / totalRetailers) * 100 : 0;

    return { osa: osaPct, sellin: sellinPct, bio: bioPct, inc: incPct };
}
