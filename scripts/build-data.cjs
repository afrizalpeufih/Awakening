// Build data.json from UPDATE 16 JULI.xlsx
// Metrics per user spec:
// 1. OSA KPI SE = SUM(OSA KPI MTD) all retailers vs SUM(TARGET OSA JULY)
// 2. SELLIN SP3GB SE = SUM(Sellin SP3GB MTD) vs SUM(Target Sellin SP3GB)
// 3. BIOMETRIK = count(BIO MTD > 1) / count(all retailers) * 100
// 4. INCREMENTAL = SUM(Incremental) but ONLY retailers with Visit 1,5 Jam >= 1
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SRC = 'C:\\Users\\AMN\\Documents\\Projek\\Projectg\\AWAKENING\\UPDATE 16 JULI.xlsx';
const wb = XLSX.readFile(SRC, { cellDates: true });

const dataWs = wb.Sheets['DATA'];
const targetWs = wb.Sheets['TARGET'];
const dataRows = XLSX.utils.sheet_to_json(dataWs);
const targetRows = XLSX.utils.sheet_to_json(targetWs);

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const retailers = dataRows.map((r) => ({
    tsName: String(r['TS_NAME'] ?? ''),
    seName: String(r['SE_NAME'] ?? ''),
    retailerName: String(r['RETAILER_NAME'] ?? ''),
    qr: num(r['RETAILER_QR CODE']),
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

const targetBySe = {};
for (const t of targetRows) {
    targetBySe[String(t['SE_NAME'])] = {
        tsName: String(t['TS_NAME'] ?? ''),
        targetOsa: num(t['TARGET OSA JULY']),
        targetSellin: num(t['Target Sellin SP3GB']),
    };
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

const totals = {
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

const bySe = {};
for (const r of retailers) {
    (bySe[r.seName] = bySe[r.seName] || []).push(r);
}
const seList = Object.entries(bySe).map(([seName, rows]) => {
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

const out = {
    generatedAt: new Date().toISOString(),
    source: 'UPDATE 16 JULI.xlsx',
    totals,
    seList,
    retailers,
};

const outPath = path.join(__dirname, '..', 'public', 'data.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('WROTE', outPath);
console.log(JSON.stringify(totals, null, 2));
