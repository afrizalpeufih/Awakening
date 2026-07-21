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
