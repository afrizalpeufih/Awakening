import * as XLSX from 'xlsx';
import type { DashboardData, Retailer, SeRow, Totals } from './types';

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Flexible column key resolver that handles space/underscore variations,
 * uppercase/lowercase, and different month names in column titles.
 */
const getVal = (row: Record<string, any>, keys: string[]): any => {
    if (!row) return undefined;
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return row[k];
    }
    const rowKeys = Object.keys(row);
    for (const key of keys) {
        const normalizedKey = key.toLowerCase().replace(/[\s_]+/g, '');
        const matchedKey = rowKeys.find(
            (rk) => rk.toLowerCase().replace(/[\s_]+/g, '') === normalizedKey
        );
        if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
            return row[matchedKey];
        }
    }
    return undefined;
};

/**
 * Parse Excel workbook ArrayBuffer into DashboardData
 */
export function parseExcelWorkbook(buffer: ArrayBuffer, fileName: string): DashboardData {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

    const dataSheetName = wb.SheetNames.find((s) => s.toUpperCase() === 'DATA') || wb.SheetNames[0];
    const targetSheetName = wb.SheetNames.find((s) => s.toUpperCase() === 'TARGET') || wb.SheetNames[1];
    const ecSheetName = wb.SheetNames.find((s) => s.toUpperCase() === 'EC');

    if (!dataSheetName) {
        throw new Error('Sheet "DATA" tidak ditemukan dalam file Excel.');
    }

    const dataWs = wb.Sheets[dataSheetName];
    const targetWs = targetSheetName ? wb.Sheets[targetSheetName] : null;
    const ecWs = ecSheetName ? wb.Sheets[ecSheetName] : null;

    const dataRows: Record<string, any>[] = XLSX.utils.sheet_to_json(dataWs);
    const targetRows: Record<string, any>[] = targetWs ? XLSX.utils.sheet_to_json(targetWs) : [];
    const ecRows: Record<string, any>[] = ecWs ? XLSX.utils.sheet_to_json(ecWs) : [];

const getDayFromKey = (key: string): number | null => {
    const cleanK = String(key).trim();
    const n = Number(cleanK);
    if (!isNaN(n) && n > 31 && n < 60000) {
        const d = new Date(Math.round((n - 25569) * 86400 * 1000));
        return d.getUTCDate();
    }
    if (!isNaN(n) && n >= 1 && n <= 31) {
        return n;
    }
    const parts = cleanK.split(/[\/\-\s]+/);
    if (parts.length >= 2) {
        const p0 = parseInt(parts[0], 10);
        if (!isNaN(p0) && p0 >= 1 && p0 <= 31) return p0;
        const p2 = parseInt(parts[2], 10);
        if (!isNaN(p2) && p2 >= 1 && p2 <= 31) return p2;
    }
    const dt = Date.parse(cleanK);
    if (!isNaN(dt)) {
        return new Date(dt).getDate();
    }
    return null;
};

    const ecBySe: Record<string, { total: number; target: number; daily: Record<number, number> }> = {};
    for (const row of ecRows) {
        const se = String(getVal(row, ['SE_NAME', 'SE NAME', 'SE']) ?? '').trim();
        if (se) {
            const totalVal = getVal(row, ['TOTAL', 'Total', 'Total EC']);
            let total = num(totalVal);
            if (totalVal === undefined || totalVal === null) {
                total = Object.entries(row).reduce((sum, [k, v]) => {
                    const normK = k.toLowerCase().trim();
                    if (['ts name', 'ts_name', 'se name', 'se_name', 'rural/urban', 'target', 'target '].includes(normK)) return sum;
                    return sum + num(v);
                }, 0);
            }
            const target = num(getVal(row, ['TARGET', 'Target', 'Target ', 'TARGET EC']));

            const daily: Record<number, number> = {};
            for (let day = 1; day <= 31; day++) daily[day] = 0;

            for (const [k, v] of Object.entries(row)) {
                const normK = k.toLowerCase().trim();
                if (['ts name', 'ts_name', 'se name', 'se_name', 'rural/urban', 'total', 'target', 'target '].includes(normK)) {
                    continue;
                }
                const dayNum = getDayFromKey(k);
                if (dayNum !== null && dayNum >= 1 && dayNum <= 31) {
                    daily[dayNum] = num(v);
                }
            }

            ecBySe[se] = { total, target, daily };
        }
    }

    const targetBySe: Record<string, { tsName: string; targetOsa: number; targetSellin: number; targetIncremental: number; targetVisit: number }> = {};
    for (const t of targetRows) {
        const se = String(getVal(t, ['SE_NAME', 'SE NAME', 'SE']) ?? '').trim();
        if (se) {
            targetBySe[se] = {
                tsName: String(getVal(t, ['TS_NAME', 'TS NAME', 'TS']) ?? '').trim(),
                targetOsa: num(getVal(t, ['TARGET OSA JULY', 'TARGET OSA AUGUST', 'TARGET OSA', 'TARGET OSA MONTH'])),
                targetSellin: num(getVal(t, ['Target Sellin SP3GB', 'TARGET SELLIN SP3GB', 'TARGET SELLIN'])),
                targetIncremental: num(getVal(t, ['Target INCREMENTAL', 'TARGET INCREMENTAL', 'INCREMENTAL TARGET', 'TARGET INC'])) || 40,
                targetVisit: num(getVal(t, ['Target VISIT', 'TARGET VISIT', 'VISIT TARGET'])) || 20,
            };
        }
    }

    const retailers: Retailer[] = dataRows.map((r) => {
        const seName = String(getVal(r, ['SE_NAME', 'SE NAME', 'SE']) ?? '').trim();
        const tsNameFromData = String(getVal(r, ['TS_NAME', 'TS NAME', 'TS']) ?? '').trim();
        const targetInfo = targetBySe[seName];
        const tsName = tsNameFromData || targetInfo?.tsName || '';

        return {
            tsName,
            seName,
            retailerName: String(getVal(r, ['RETAILER_NAME', 'RETAILER NAME', 'RETAILER']) ?? '').trim(),
            qr: String(getVal(r, ['RETAILER_QR CODE', 'RETAILER QR CODE', 'QR CODE', 'QR']) ?? '').trim(),
            type: String(getVal(r, ['RETAILER_TYPE', 'RETAILER TYPE', 'TYPE']) ?? '').trim(),
            sellinLmtd: num(getVal(r, ['Sellin SP3GB LMTD', 'SELLIN LMTD'])),
            osaLmtd: num(getVal(r, ['OSA KPI LMTD', 'OSA LMTD'])),
            sellinMtd: num(getVal(r, ['Sellin SP3GB MTD', 'SELLIN MTD'])),
            osaMtd: num(getVal(r, ['OSA KPI MTD', 'OSA MTD'])),
            bioLmtd: num(getVal(r, ['BIO LMTD', 'BIOMETRIK LMTD'])),
            bioMtd: num(getVal(r, ['BIO MTD', 'BIOMETRIK MTD'])),
            incremental: num(getVal(r, ['Incremental', 'INCREMENTAL'])),
            visit: num(getVal(r, ['Visit 1,5 Jam', 'VISIT 1.5 JAM', 'VISIT 1,5 JAM', 'VISIT'])),
        };
    });

    const totalRetailers = retailers.length;
    const osaMtd = retailers.reduce((s, r) => s + r.osaMtd, 0);
    const sellinMtd = retailers.reduce((s, r) => s + r.sellinMtd, 0);
    const bioGt1 = retailers.filter((r) => r.bioMtd >= 1).length;
    const incremental = retailers
        .filter((r) => r.visit >= 1)
        .reduce((s, r) => s + r.incremental, 0);

    const targetOsa = Object.values(targetBySe).reduce((s, t) => s + t.targetOsa, 0);
    const targetSellin = Object.values(targetBySe).reduce((s, t) => s + t.targetSellin, 0);
    const targetIncremental = Object.values(targetBySe).reduce((s, t) => s + t.targetIncremental, 0);
    const targetVisit = Object.values(targetBySe).reduce((s, t) => s + t.targetVisit, 0);

    const osaPct = targetOsa ? (osaMtd / targetOsa) * 100 : 0;
    const sellinPct = targetSellin ? (sellinMtd / targetSellin) * 100 : 0;
    const biometrikPct = totalRetailers ? (bioGt1 / totalRetailers) * 100 : 0;

    const totalEcTotal = Object.values(ecBySe).reduce((s, e) => s + e.total, 0);
    const totalEcTarget = Object.values(ecBySe).reduce((s, e) => s + e.target, 0);
    const ecPct = totalEcTarget > 0 ? (totalEcTotal / totalEcTarget) * 100 : 0;

    const transactedRetailers = retailers.filter((r) => r.osaMtd !== 0).length;
    const untransactedRetailers = totalRetailers - transactedRetailers;

    const totals: Totals = {
        osaMtd,
        targetOsa,
        osaPct,
        sellinMtd,
        targetSellin,
        sellinPct,
        biometrikCount: bioGt1,
        biometrikPct,
        incremental,
        targetIncremental,
        targetVisit,
        totalRetailers,
        visitedRetailers: retailers.filter((r) => r.visit >= 1).length,
        transactedRetailers,
        untransactedRetailers,
        ecTotal: totalEcTotal,
        ecTarget: totalEcTarget,
        ecPct,
    };

    const bySe: Record<string, Retailer[]> = {};
    for (const r of retailers) {
        if (!r.seName) continue;
        (bySe[r.seName] = bySe[r.seName] || []).push(r);
    }

    const seList: SeRow[] = Object.entries(bySe).map(([seName, rows]) => {
        const t = targetBySe[seName] || { tsName: rows[0]?.tsName || '', targetOsa: 0, targetSellin: 0, targetIncremental: 40, targetVisit: 20 };
        const seTsName = t.tsName || rows[0]?.tsName || '';
        const seOsa = rows.reduce((s, r) => s + r.osaMtd, 0);
        const seSellin = rows.reduce((s, r) => s + r.sellinMtd, 0);
        const seBio = rows.filter((r) => r.bioMtd >= 1).length;
        const seInc = rows.filter((r) => r.visit >= 1).reduce((s, r) => s + r.incremental, 0);
        const seVisit = rows.filter((r) => r.visit >= 1).length;
        const seTransacted = rows.filter((r) => r.osaMtd !== 0).length;
        const seUntransacted = rows.length - seTransacted;
        const ecInfo = ecBySe[seName] || { total: 0, target: 0, daily: {} };
        const seEcPct = ecInfo.target > 0 ? (ecInfo.total / ecInfo.target) * 100 : 0;
        return {
            seName,
            tsName: seTsName,
            count: rows.length,
            osaMtd: seOsa,
            sellinMtd: seSellin,
            bioGt1: seBio,
            incremental: seInc,
            targetIncremental: t.targetIncremental,
            targetVisit: t.targetVisit,
            visitedRetailers: seVisit,
            transactedRetailers: seTransacted,
            untransactedRetailers: seUntransacted,
            targetOsa: t.targetOsa,
            targetSellin: t.targetSellin,
            osaPct: t.targetOsa ? (seOsa / t.targetOsa) * 100 : 0,
            sellinPct: t.targetSellin ? (seSellin / t.targetSellin) * 100 : 0,
            biometrikPct: rows.length ? (seBio / rows.length) * 100 : 0,
            ecTotal: ecInfo.total,
            ecTarget: ecInfo.target,
            ecPct: seEcPct,
            ecDaily: ecInfo.daily,
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        source: fileName,
        totals,
        seList,
        retailers,
    };
}