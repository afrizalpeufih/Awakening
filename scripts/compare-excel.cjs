const XLSX = require('xlsx');

const n = XLSX.readFile('C:\\\\Users\\\\AMN\\\\Documents\\\\Projek\\\\Projectg\\\\AWAKENING\\\\UPDATE 20 JULI.xlsx', { cellDates: true });
const o = XLSX.readFile('C:\\Users\\AMN\\Documents\\Projek\\Projectg\\AWAKENING\\UPDATE 16 JULI.xlsx', { cellDates: true });

const dn = XLSX.utils.sheet_to_json(n.Sheets['DATA'], { defval: '' });
const dno = XLSX.utils.sheet_to_json(o.Sheets['DATA'], { defval: '' });

const keys = Object.keys(dn[0]);
console.log('Total columns:', keys.length);
console.log('Columns:', keys.join(', '));
console.log('');

// Count changes per column
const colChanges = {};
keys.forEach(k => colChanges[k] = 0);
const allDiffs = [];

for (let i = 0; i < Math.max(dn.length, dno.length); i++) {
    const diffEntry = { row: i, name: '', changes: {} };
    for (const k of keys) {
        const nv = String(dn[i]?.[k] ?? '');
        const ov = String(dno[i]?.[k] ?? '');
        if (nv !== ov) {
            colChanges[k]++;
            diffEntry.changes[k] = { new: nv, old: ov };
        }
    }
    if (Object.keys(diffEntry.changes).length > 0) {
        diffEntry.name = dn[i]?.['RETAILER_NAME'] || '';
        allDiffs.push(diffEntry);
    }
}

console.log('=== Changes per column ===');
keys.forEach(k => {
    if (colChanges[k] > 0) console.log(`  ${k}: ${colChanges[k]} rows changed`);
});

console.log('\n=== All different rows (total:', allDiffs.length, ') ===');
for (const d of allDiffs) {
    console.log(`\nRow ${d.row} - ${d.name}:`);
    for (const [col, vals] of Object.entries(d.changes)) {
        console.log(`  ${col}: NEW=${vals.new}  OLD=${vals.old}`);
    }
}

// Calculate new totals from NEW file
const sellinMtd = dn.reduce((s, r) => s + Number(r['Sellin SP3GB MTD']), 0);
const osaMtd = dn.reduce((s, r) => s + Number(r['OSA KPI MTD']), 0);
const bioGt1 = dn.filter(r => Number(r['BIO MTD']) > 1).length;
const incVisitGte1 = dn.filter(r => Number(r['Visit 1,5 Jam']) >= 1).reduce((s, r) => s + Number(r['Incremental']), 0);
const visitGte1 = dn.filter(r => Number(r['Visit 1,5 Jam']) >= 1).length;
const transacted = dn.filter(r => Number(r['OSA KPI MTD']) !== 0).length;
const bioSum = dn.reduce((s, r) => s + Number(r['BIO MTD']), 0);

// Old totals
const oldSellinMtd = dno.reduce((s, r) => s + Number(r['Sellin SP3GB MTD']), 0);
const oldOsaMtd = dno.reduce((s, r) => s + Number(r['OSA KPI MTD']), 0);
const oldBioGt1 = dno.filter(r => Number(r['BIO MTD']) > 1).length;
const oldIncVisitGte1 = dno.filter(r => Number(r['Visit 1,5 Jam']) >= 1).reduce((s, r) => s + Number(r['Incremental']), 0);
const oldVisitGte1 = dno.filter(r => Number(r['Visit 1,5 Jam']) >= 1).length;
const oldTransacted = dno.filter(r => Number(r['OSA KPI MTD']) !== 0).length;
const oldBioSum = dno.reduce((s, r) => s + Number(r['BIO MTD']), 0);

// Targets
const tn = XLSX.utils.sheet_to_json(n.Sheets['TARGET'], { defval: '' });
const to = XLSX.utils.sheet_to_json(o.Sheets['TARGET'], { defval: '' });
const targetOsa = tn.reduce((s, t) => s + Number(t['TARGET OSA JULY']), 0);
const targetSellin = tn.reduce((s, t) => s + Number(t['Target Sellin SP3GB']), 0);
const oldTargetOsa = to.reduce((s, t) => s + Number(t['TARGET OSA JULY']), 0);
const oldTargetSellin = to.reduce((s, t) => s + Number(t['Target Sellin SP3GB']), 0);

console.log('\n========== SUMMARY COMPARISON ==========');
console.log('');

const fmt = (n) => Number(n).toLocaleString('id-ID');
const pct = (n) => (n * 100).toFixed(2);

console.log('TARGET OSA JULY  :', fmt(targetOsa), targetOsa === oldTargetOsa ? '(SAMA)' : '(BERUBAH!)');
console.log('Target Sellin    :', fmt(targetSellin), targetSellin === oldTargetSellin ? '(SAMA)' : '(BERUBAH!)');
console.log('');

const metrics = [
    ['OSA KPI MTD SUM  ', osaMtd, oldOsaMtd, fmt],
    ['SELLIN SP3GB MTD ', sellinMtd, oldSellinMtd, fmt],
    ['BIO MTD SUM      ', bioSum, oldBioSum, fmt],
    ['BIO MTD >1 COUNT ', bioGt1, oldBioGt1, String],
    ['INCREMENTAL (visit>=1)', incVisitGte1, oldIncVisitGte1, fmt],
    ['VISIT >=1 COUNT  ', visitGte1, oldVisitGte1, String],
    ['TRANSACTED(OSA>0)', transacted, oldTransacted, String],
];

console.log('Metric                | NEW (19 Juli) | OLD (16 Juli) | Status');
console.log('----------------------|---------------|---------------|-------');
for (const [name, newVal, oldVal, formatter] of metrics) {
    const status = newVal !== oldVal ? 'BERUBAH!' : 'sama';
    console.log(`${name.padEnd(22)}| ${formatter(newVal).padStart(13)} | ${formatter(oldVal).padStart(13)} | ${status}`);
}

// Show OSA KPI per-row changes
let osaDiffs = [];
for (let i = 0; i < dn.length; i++) {
    const nv = Number(dn[i]['OSA KPI MTD']);
    const ov = Number(dno[i]['OSA KPI MTD']);
    if (nv !== ov) osaDiffs.push({ row: i, name: dn[i]['RETAILER_NAME'], new: nv, old: ov, diff: nv - ov });
}
if (osaDiffs.length > 0) {
    console.log('\n=== OSA KPI MTD per-row changes ===');
    osaDiffs.forEach(d => console.log(`  Row ${d.row} ${d.name}: ${d.old} -> ${d.new} (${d.diff > 0 ? '+' : ''}${d.diff})`));
}

// Show SELLIN per-row changes
let sellinDiffs = [];
for (let i = 0; i < dn.length; i++) {
    const nv = Number(dn[i]['Sellin SP3GB MTD']);
    const ov = Number(dno[i]['Sellin SP3GB MTD']);
    if (nv !== ov) sellinDiffs.push({ row: i, name: dn[i]['RETAILER_NAME'], new: nv, old: ov, diff: nv - ov });
}
if (sellinDiffs.length > 0) {
    console.log('\n=== SELLIN SP3GB MTD per-row changes ===');
    sellinDiffs.forEach(d => console.log(`  Row ${d.row} ${d.name}: ${d.old} -> ${d.new} (${d.diff > 0 ? '+' : ''}${d.diff})`));
}

// Show BIO MTD per-row changes
let bioDiffs = [];
for (let i = 0; i < dn.length; i++) {
    const nv = Number(dn[i]['BIO MTD']);
    const ov = Number(dno[i]['BIO MTD']);
    if (nv !== ov) bioDiffs.push({ row: i, name: dn[i]['RETAILER_NAME'], new: nv, old: ov, diff: nv - ov });
}
if (bioDiffs.length > 0) {
    console.log('\n=== BIO MTD per-row changes ===');
    bioDiffs.forEach(d => console.log(`  Row ${d.row} ${d.name}: ${d.old} -> ${d.new} (${d.diff > 0 ? '+' : ''}${d.diff})`));
}

// Show Incremental per-row changes
let incDiffs = [];
for (let i = 0; i < dn.length; i++) {
    const nv = Number(dn[i]['Incremental']);
    const ov = Number(dno[i]['Incremental']);
    if (nv !== ov) incDiffs.push({ row: i, name: dn[i]['RETAILER_NAME'], new: nv, old: ov, diff: nv - ov });
}
if (incDiffs.length > 0) {
    console.log('\n=== Incremental per-row changes ===');
    incDiffs.forEach(d => console.log(`  Row ${d.row} ${d.name}: ${d.old} -> ${d.new} (${d.diff > 0 ? '+' : ''}${d.diff})`));
}
