import { pctColor } from '../calc';

export type SubLabelGroup = {
    label: string;
    count: number;
    total: number;
    showTotal?: boolean;
    format?: 'ratio' | 'accounting';
    pct?: string;
};

type Props = {
    title: string;
    value: string;
    sub?: string;
    pct: number;
    accent: 'pink' | 'orange';
    onClick?: () => void;
    active?: boolean;
    hint?: string;
    subLabels?: [SubLabelGroup, SubLabelGroup];
};

export default function KpiCard({ title, value, sub, pct, accent, onClick, active, hint, subLabels }: Props) {
    const clamped = Math.max(0, Math.min(100, pct));
    const interactive = Boolean(onClick);

    const fmtGroup = (g: SubLabelGroup) => {
        // Format accounting: 76.296.050 (pakai toLocaleString)
        const countStr = g.format === 'accounting'
            ? g.count.toLocaleString('id-ID')
            : g.count;

        if (g.showTotal === false) {
            // Jika ada pct, tampilkan: "countStr (pct%)"
            if (g.pct) {
                return `${countStr} (${g.pct}%)`;
            }
            return countStr;
        }

        const totalStr = g.format === 'accounting'
            ? g.total.toLocaleString('id-ID')
            : g.total;
        const p = g.total > 0 ? ((g.count / g.total) * 100).toFixed(1) : '0.0';
        return `${countStr}/${totalStr} (${p}%)`;
    };

    return (
        <article
            className={`kpi kpi--${accent}${interactive ? ' kpi--clickable' : ''}${active ? ' kpi--active' : ''}`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? Boolean(active) : undefined}
            onClick={onClick}
            onKeyDown={
                interactive
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onClick?.();
                        }
                    }
                    : undefined
            }
        >
            <div className="kpi-top">
                <span className="kpi-title">{title}</span>
                <span className="kpi-badge" style={{ color: pctColor(pct) }}>
                    {clamped.toFixed(0)}%
                </span>
            </div>
            <div className="kpi-value">{value}</div>
            {subLabels ? (
                <div className="kpi-bio-sublabels">
                    <span className="kpi-bio-label kpi-bio-label--first">
                        <span className="kpi-bio-dot kpi-bio-dot--first" />
                        {subLabels[0].label}: {fmtGroup(subLabels[0])}
                    </span>
                    <span className="kpi-bio-sep">|</span>
                    <span className="kpi-bio-label kpi-bio-label--second">
                        <span className="kpi-bio-dot kpi-bio-dot--second" />
                        {subLabels[1].label}: {fmtGroup(subLabels[1])}
                    </span>
                </div>
            ) : (
                sub && <div className="kpi-sub">{sub}</div>
            )}
            <div className="kpi-bar">
                <span
                    className="kpi-bar-fill"
                    style={{
                        width: `${clamped}%`,
                        background:
                            accent === 'pink'
                                ? 'linear-gradient(90deg,#ff5fb4,#ff9bd6)'
                                : 'linear-gradient(90deg,#ff8a3d,#ffc24d)',
                    }}
                />
            </div>
            {interactive && (
                <span className="kpi-hint">{hint ?? 'Klik: lihat outlet'}</span>
            )}
        </article>
    );
}
