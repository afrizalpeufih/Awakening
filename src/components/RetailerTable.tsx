import { useState, useMemo } from 'react';
import type { Retailer } from '../types';

export type MetricKey = 'osa' | 'sellin' | 'biometrik' | 'incremental';

type SortDir = 'asc' | 'desc' | null;

function formatVal(n: number): string {
    return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

type Props = {
    metric: MetricKey;
    allRetailers: Retailer[];
    onClose: () => void;
};

type MetricMeta = {
    title: string;
    leftLabel: string;
    rightLabel: string | null;
    match: (r: Retailer) => boolean;
    opposite: (r: Retailer) => boolean;
    dual: boolean;
    showSub: boolean;
    metricLabel: string;
    metricValue: (r: Retailer) => React.ReactNode;
    metricClass: (r: Retailer) => string;
    /** numeric value used for sorting */
    sortValue: (r: Retailer) => number;
};

const META: Record<MetricKey, MetricMeta> = {
    osa: {
        title: 'OSA KPI SE — data Retailer',
        leftLabel: 'OSA MTD > 0 (TRANSAKSI)',
        rightLabel: 'OSA MTD = 0 (OSA NULL)',
        match: (r) => r.osaMtd > 0,
        opposite: (r) => r.osaMtd === 0,
        dual: true,
        showSub: false,
        metricLabel: 'OSA',
        metricValue: (r) => formatVal(r.osaMtd),
        metricClass: (r) => (r.osaMtd > 0 ? 'pos' : 'neg'),
        sortValue: (r) => r.osaMtd,
    },
    sellin: {
        title: 'SELLIN SP3GB SE — data Retailer',
        leftLabel: 'SELLIN MTD > 0 (TRANSAKSI)',
        rightLabel: 'SELLIN MTD = 0 (NO TRANSAKSI)',
        match: (r) => r.sellinMtd > 0,
        opposite: (r) => r.sellinMtd === 0,
        dual: true,
        showSub: true,
        metricLabel: 'Sellin',
        metricValue: (r) => formatVal(r.sellinMtd),
        metricClass: (r) => (r.sellinMtd > 0 ? 'pos' : 'neg'),
        sortValue: (r) => r.sellinMtd,
    },
    biometrik: {
        title: 'BIOMETRIK — data Retailer',
        leftLabel: 'BIOMETRIK > 0 (ADA BIO)',
        rightLabel: 'BIOMETRIK = 0 (NULL BIO)',
        match: (r) => r.bioMtd > 0,
        opposite: (r) => r.bioMtd === 0,
        dual: true,
        showSub: true,
        metricLabel: 'Bio',
        metricValue: (r) => formatVal(r.bioMtd),
        metricClass: (r) => (r.bioMtd > 0 ? 'pos' : 'neg'),
        sortValue: (r) => r.bioMtd,
    },
    incremental: {
        title: 'INCREMENTAL — data Retailer',
        leftLabel: 'RETAILER DENGAN INCREMENTAL > 0',
        rightLabel: null,
        match: (r) => r.incremental > 0,
        opposite: () => false,
        dual: false,
        showSub: true,
        metricLabel: 'Detail',
        metricValue: (r) => (
            <div className="incremental-grid">
                <div className="inc-cell">
                    <span className="inc-label">BIO LMTD</span>
                    <span className="inc-val">{formatVal(r.bioLmtd)}</span>
                </div>
                <div className="inc-cell">
                    <span className="inc-label">BIO MTD</span>
                    <span className="inc-val">{formatVal(r.bioMtd)}</span>
                </div>
                <div className={`inc-cell ${r.visit > 0 ? 'inc-cell--pos' : 'inc-cell--neg'}`}>
                    <span className="inc-label">Incremental</span>
                    <span className="inc-val">{formatVal(r.incremental)}</span>
                </div>
                <div className={`inc-cell ${r.visit > 0 ? 'inc-cell--pos' : 'inc-cell--neg'}`}>
                    <span className="inc-label">Visit</span>
                    <span className="inc-val">{formatVal(r.visit)}</span>
                </div>
            </div>
        ),
        metricClass: () => '',
        sortValue: (r) => r.incremental,
    },
};

const MAX_VISIBLE = 10;

function RetailerRows({ rows, metric, expanded, onToggleExpanded }: {
    rows: Retailer[];
    metric: MetricKey;
    expanded: boolean;
    onToggleExpanded: () => void;
}) {
    if (rows.length === 0) {
        return <div className="retailer-empty">Tidak ada retailer</div>;
    }
    const m = META[metric];
    const visible = expanded ? rows : rows.slice(0, MAX_VISIBLE);
    const hiddenCount = rows.length - MAX_VISIBLE;
    return (
        <>
            <ul className="retailer-list">
                {visible.map((r, i) => (
                    <li className="retailer-item" key={`${r.retailerName}-${r.seName}-${i}`}>
                        <div className="retailer-main">
                            <span className="retailer-name">{r.retailerName}</span>
                            <span className="retailer-qr">QR: {r.qr}</span>
                        </div>
                        <div className="retailer-val-wrap">
                            <span className={`retailer-val ${m.metricClass(r)}`}>
                                {m.metricValue(r)}
                            </span>
                            {metric !== 'incremental' && (
                                <span className="retailer-val-label">{m.metricLabel}</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            {hiddenCount > 0 && !expanded && (
                <button className="show-more-btn" onClick={onToggleExpanded}>
                    <span>Lihat selengkapnya</span>
                    <span className="show-more-count">+{hiddenCount} outlet</span>
                </button>
            )}
        </>
    );
}

const SORT_ICONS: Record<string, string> = { asc: '\u2191', desc: '\u2193' };
const SORT_LABELS: Record<string, string> = { asc: 'naik', desc: 'turun' };

function SortBtn({
    dir,
    onToggle,
}: {
    dir: SortDir;
    onToggle: () => void;
}) {
    const icon = dir ? SORT_ICONS[dir] : '\u21C5';
    const label = dir ? `Urut ${SORT_LABELS[dir]}` : 'Urutkan';
    return (
        <button
            type="button"
            className={'sort-btn' + (dir ? ' sort-btn--active' : '')}
            onClick={onToggle}
            aria-label={label}
            title={label}
        >
            {icon}
        </button>
    );
}

function sortRows(rows: Retailer[], dir: SortDir, sv: (r: Retailer) => number): Retailer[] {
    if (!dir) return rows;
    const sorted = [...rows].sort((a, b) => sv(a) - sv(b));
    return dir === 'desc' ? sorted.reverse() : sorted;
}

export default function RetailerTable({ metric, allRetailers, onClose }: Props) {
    const meta = META[metric];
    const leftAll = allRetailers.filter(meta.match);
    const rightAll = meta.dual ? allRetailers.filter(meta.opposite) : [];

    const [sortLeft, setSortLeft] = useState<SortDir>(null);
    const [sortRight, setSortRight] = useState<SortDir>(null);
    const [expandedLeft, setExpandedLeft] = useState(false);
    const [expandedRight, setExpandedRight] = useState(false);

    const left = useMemo(() => sortRows(leftAll, sortLeft, meta.sortValue), [leftAll, sortLeft, meta]);
    const right = useMemo(() => sortRows(rightAll, sortRight, meta.sortValue), [rightAll, sortRight, meta]);

    const toggleLeft = () => setSortLeft((s) => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'));
    const toggleRight = () => setSortRight((s) => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'));

    const toggleExpandLeft = () => setExpandedLeft((s) => !s);
    const toggleExpandRight = () => setExpandedRight((s) => !s);

    return (
        <section className="panel retailer-panel-wrap">
            <div className="panel-head">
                <div>
                    <h2 className="panel-title">{meta.title}</h2>
                    {meta.showSub && (
                        <p className="panel-sub">
                            {meta.dual
                                ? `Total ${allRetailers.length} outlet · Kiri: ${left.length} · Kanan: ${right.length}`
                                : `Total ${left.length} outlet`}
                        </p>
                    )}
                </div>
                <button className="btn-close" onClick={onClose} aria-label="Tutup daftar retailer">
                    Tutup ✕
                </button>
            </div>

            {meta.dual ? (
                <div className="retailer-grid">
                    <div className="retailer-panel retailer-panel--left">
                        <div className="retailer-panel-head">
                            <span className="dot dot--pos" /> {meta.leftLabel}{' '}
                            <SortBtn dir={sortLeft} onToggle={toggleLeft} />
                            <span className="retailer-count">{left.length}</span>
                        </div>
                        <div className="table-wrap">
                            <RetailerRows rows={left} metric={metric} expanded={expandedLeft} onToggleExpanded={toggleExpandLeft} />
                        </div>
                    </div>
                    <div className="retailer-panel retailer-panel--right">
                        <div className="retailer-panel-head">
                            <span className="dot dot--neg" /> {meta.rightLabel}{' '}
                            <SortBtn dir={sortRight} onToggle={toggleRight} />
                            <span className="retailer-count">{right.length}</span>
                        </div>
                        <div className="table-wrap">
                            <RetailerRows rows={right} metric={metric} expanded={expandedRight} onToggleExpanded={toggleExpandRight} />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="retailer-grid retailer-grid--single">
                    <div className="retailer-panel retailer-panel--left">
                        <div className="retailer-panel-head">
                            <span className="dot dot--pos" /> {meta.leftLabel}{' '}
                            <SortBtn dir={sortLeft} onToggle={toggleLeft} />
                            <span className="retailer-count">{left.length}</span>
                        </div>
                        <div className="table-wrap">
                            <RetailerRows rows={left} metric={metric} expanded={expandedLeft} onToggleExpanded={toggleExpandLeft} />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
