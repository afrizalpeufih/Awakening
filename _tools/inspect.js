const XLSX = require('xlsx');
const path = 'C:\\Users\\AMN\\Documents\\Projek\\Projectg\\AWAKENING\\UPDATE 16 JULI.xlsx';
const wb = XLSX.readFile(path, { cellStyles: false });
console.log('SHEETS:', JSON.stringify(wb.SheetNames));
for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref']);
    console.log('\n=== SHEET:', name, ' dim:', ws['!ref'], '===');
    const headers = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
        headers.push(cell ? String(cell.v) : '');
    }
    console.log('HEADERS(' + headers.length + '):', JSON.stringify(headers));
    const sample = [];
    for (let r = range.s.r + 1; r <= Math.min(range.s.r + 3, range.e.r); r++) {
        const row = {};
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            const h = headers[c - range.s.c];
            row[h] = cell ? cell.v : null;
        }
        sample.push(row);
    }
    console.log('SAMPLE ROWS:');
    sample.forEach((s, i) => console.log(' row' + i + ':', JSON.stringify(s)));
}
