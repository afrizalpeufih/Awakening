import * as XLSX from 'xlsx';
import type { DashboardData, Retailer, SeRow, Totals } from './types';

const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Parse Excel workbook ArrayBuffer into DashboardData
 */
export function parseExcelWorkbook(buffer: ArrayBuffer, fileName: string): DashboardData {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

    const dataSheetName = wb.SheetNames.find((s) => s.toUpperCase() === 'DATA') || wb.SheetNames[0];
    const targetSheetName = wb.SheetNames.find((s) => s.toUpperCase() === 'TARGET') || wb.SheetNames[1];

    if (!dataSheetName) {
        throw new Error('Sheet "DATA" tidak ditemukan dalam file Excel.');
    }

    const dataWs = wb.Sheets[dataSheetName];
    const targetWs = targetSheetName ? wb.Sheets[targetSheetName] : null;

    const dataRows: Record<string, any>[] = XLSX.utils.sheet_to_json(dataWs);
    const targetRows: Record<string, any>[] = targetWs ? XLSX.utils.sheet_to_json(targetWs) : [];

    const retailers: Retailer[] = dataRows.map((r) => ({
        tsName: String(r['TS_NAME'] ?? ''),
        seName: String(r['SE_NAME'] ?? ''),
        retailerName: String(r['RETAILER_NAME'] ?? ''),
        qr: String(r['RETAILER_QR CODE'] ?? ''),
        type: String(r['RETAILER_TYPE'] ?? ''),
        sellinLmtd: num(r['Sellin SP3GB LMTD']),
        osaLmtd: num(r['OSA KPI LMTD']),
        sellinMtd: num(r['Sellin SP3GB MTD']),
        osaMtd: num(r['OSA KPI MTD']),
        bioLmtd: num(r['BIO LMTD']),
        bioMtd: num(r['BIO MTD']),
        incremental: num(r['Incremental']),
        visit: num(r['Visit 1,5 Jam']),
    }));

    const targetBySe: Record<string, { tsName: string; targetOsa: number; targetSellin: number }> = {};
    for (const t of targetRows) {
        const se = String(t['SE_NAME'] ?? '');
        if (se) {
            targetBySe[se] = {
                tsName: String(t['TS_NAME'] ?? ''),
                targetOsa: num(t['TARGET OSA JULY']),
                targetSellin: num(t['Target Sellin SP3GB']),
            };
        }
    }

    const totalRetailers = retailers.length;
    const osaMtd = retailers.reduce((s, r) => s + r.osaMtd, 0);
    const sellinMtd = retailers.reduce((s, r) => s + r.sellinMtd, 0);
    const bioGt1 = retailers.filter((r) => r.bioMtd > 1).length;
    const incremental = retailers
        .filter((r) => r.visit >= 1)
        .reduce((s, r) => s + r.incremental, 0);

    const targetOsa = Object.values(targetBySe).reduce((s, t) => s + t.targetOsa, 0);
    const targetSellin = Object.values(targetBySe).reduce((s, t) => s + t.targetSellin, 0);

    const osaPct = targetOsa ? (osaMtd / targetOsa) * 100 : 0;
    const sellinPct = targetSellin ? (sellinMtd / targetSellin) * 100 : 0;
    const biometrikPct = totalRetailers ? (bioGt1 / totalRetailers) * 100 : 0;

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
        totalRetailers,
        visitedRetailers: retailers.filter((r) => r.visit >= 1).length,
        transactedRetailers,
        untransactedRetailers,
    };

    const bySe: Record<string, Retailer[]> = {};
    for (const r of retailers) {
        if (!r.seName) continue;
        (bySe[r.seName] = bySe[r.seName] || []).push(r);
    }

    const seList: SeRow[] = Object.entries(bySe).map(([seName, rows]) => {
        const t = targetBySe[seName] || { tsName: rows[0]?.tsName || '', targetOsa: 0, targetSellin: 0 };
        const seOsa = rows.reduce((s, r) => s + r.osaMtd, 0);
        const seSellin = rows.reduce((s, r) => s + r.sellinMtd, 0);
        const seBio = rows.filter((r) => r.bioMtd > 1).length;
        const seInc = rows.filter((r) => r.visit >= 1).reduce((s, r) => s + r.incremental, 0);
        const seVisit = rows.filter((r) => r.visit >= 1).length;
        const seTransacted = rows.filter((r) => r.osaMtd !== 0).length;
        const seUntransacted = rows.length - seTransacted;
        return {
            seName,
            tsName: t.tsName,
            count: rows.length,
            osaMtd: seOsa,
            sellinMtd: seSellin,
            bioGt1: seBio,
            incremental: seInc,
            visitedRetailers: seVisit,
            transactedRetailers: seTransacted,
            untransactedRetailers: seUntransacted,
            targetOsa: t.targetOsa,
            targetSellin: t.targetSellin,
            osaPct: t.targetOsa ? (seOsa / t.targetOsa) * 100 : 0,
            sellinPct: t.targetSellin ? (seSellin / t.targetSellin) * 100 : 0,
            biometrikPct: rows.length ? (seBio / rows.length) * 100 : 0,
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