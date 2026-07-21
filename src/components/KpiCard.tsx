import { pctColor } from '../calc';

type Props = {
    title: string;
    value: string;
    sub: string;
    pct: number;
    accent: 'pink' | 'orange';
    onClick?: () => void;
    active?: boolean;
    hint?: string;
};

export default function KpiCard({ title, value, sub, pct, accent, onClick, active, hint }: Props) {
    const clamped = Math.max(0, Math.min(100, pct));
    const interactive = Boolean(onClick);
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
            <div className="kpi-sub">{sub}</div>
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
