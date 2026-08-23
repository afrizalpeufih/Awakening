import { pctColor } from '../calc';

export type SubLabelGroup = {
    label: string;
    count: number;
    total: number;
    showTotal?: boolean;
    format?: 'ratio' | 'accounting';
    pct?: string;
    /** Tanda eksplisit: '-' saat belum mencapai target, '+' saat tercapai/lebih */
    signed?: boolean;
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
    /** Growth vs data upload sebelumnya. delta null => tidak ada pembanding. */
    growth?: { delta: number | null; prevLabel?: string };
};

/** Ikon panah growth (▲ / ▼ / netral) */
const GrowthArrow = ({ dir }: { dir: 'up' | 'down' | 'flat' }) => {
    if (dir === 'flat') {
        return <span className="kpi-growth-dash">—</span>;
    }
    return (
        <svg
            className="kpi-growth-arrow"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
            style={dir === 'down' ? { transform: 'rotate(180deg)' } : undefined}
        >
            <path d="M6 1.5 11 8H1z" />
        </svg>
    );
};

export default function KpiCard({ title, value, sub, pct, accent, onClick, active, hint, subLabels, growth }: Props) {
    const clamped = Math.max(0, Math.min(100, pct));
    const interactive = Boolean(onClick);

    const fmtGroup = (g: SubLabelGroup) => {
        // Format accounting: 76.296.050 (pakai toLocaleString)
        const countStr = g.format === 'accounting'
            ? g.count.toLocaleString('id-ID')
            : g.count;

        if (g.showTotal === false) {
            // Format bertanda (GAP): '-N' saat belum capai (count positif), '+N' saat tercapai/lebih
            if (g.signed) {
                const belumCapai = g.count > 0;
                const absCount = Math.abs(g.count);
                const absStr = g.format === 'accounting'
                    ? absCount.toLocaleString('id-ID')
                    : String(absCount);
                const numStr = `${belumCapai ? '-' : '+'}${absStr}`;
                if (g.pct) {
                    const pctAbs = String(g.pct).replace(/^[-+]/, '');
                    return `${numStr} (${belumCapai ? '-' : '+'}${pctAbs}%)`;
                }
                return numStr;
            }
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
                {growth ? (
                    (() => {
                        const d = growth.delta;
                        if (d === null || d === undefined) {
                            return (
                                <span
                                    className="kpi-growth kpi-growth--flat"
                                    title="Tidak ada data sebelumnya sebagai pembanding"
                                >
                                    <GrowthArrow dir="flat" />
                                </span>
                            );
                        }
                        const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
                        const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
                        const abs = Math.abs(d);
                        const text = (Number.isInteger(abs) ? abs.toFixed(0) : abs.toFixed(1)) + '%';
                        return (
                            <span
                                className={`kpi-growth kpi-growth--${cls}`}
                                title={
                                    growth.prevLabel
                                        ? `Growth vs ${growth.prevLabel}`
                                        : 'Growth vs data sebelumnya'
                                }
                            >
                                {dir !== 'flat' && <GrowthArrow dir={dir} />}
                                <span>{text}</span>
                            </span>
                        );
                    })()
                ) : (
                    <span className="kpi-badge" style={{ color: pctColor(pct) }}>
                        {clamped.toFixed(0)}%
                    </span>
                )}
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
