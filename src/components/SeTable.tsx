import type { SeRow } from '../types';

type Props = {
    rows: SeRow[];
};

const pctColor = (pct: number, target: number): string => {
    if (target <= 0) return 'var(--muted)';
    const diff = pct - target;
    if (diff >= 0) return 'var(--good)';
    if (diff >= -5) return 'var(--warn)';
    return 'var(--bad)';
};

export default function SeTable({ rows }: Props) {
    if (!rows || rows.length === 0) {
        return <div className="table-wrap"><div className="se-empty">Belum ada data Sales Executive untuk teritori ini.</div></div>;
    }

    return (
        <div className="table-wrap">
            <table className="se-table">
                <thead>
                    <tr>
                        <th>Sales Executive</th>
                        <th>PJP</th>
                        <th>OSA</th>
                        <th>Sellin</th>
                        <th>Biometrik</th>
                        <th>Incremental</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.seName + '|' + r.tsName}>
                            <td>
                                <span className="se-name">{r.seName}</span>
                                <small>{r.tsName}</small>
                            </td>
                            <td>
                                <span className="pill">{r.count}</span>
                                <small>outlet</small>
                            </td>
                            <td>
                                <span className="pill" style={{ color: pctColor(r.osaPct, r.targetOsa) }}>
                                    {r.osaPct.toFixed(1)}%
                                </span>
                                <small>target {r.targetOsa.toFixed(0)}%</small>
                            </td>
                            <td>
                                <span className="pill" style={{ color: pctColor(r.sellinPct, r.targetSellin) }}>
                                    {r.sellinPct.toFixed(1)}%
                                </span>
                                <small>target {r.targetSellin.toFixed(0)}%</small>
                            </td>
                            <td>
                                <span className="pill" style={{ color: 'var(--accent)' }}>
                                    {r.biometrikPct.toFixed(1)}%
                                </span>
                                <small>{r.bioGt1} outlet &gt; 1x</small>
                            </td>
                            <td>
                                <span className="pill">{r.incremental.toLocaleString('id-ID')}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
