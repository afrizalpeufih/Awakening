import { useEffect, useRef, useState } from 'react';
import type { DashboardData, Totals } from './types';
import KpiCard from './components/KpiCard';

import RetailerTable from './components/RetailerTable';
import type { MetricKey } from './components/RetailerTable';
import { fmtNum, fmtPct } from './calc';

const ALL = 'AWAKENING';
const TERITORI = 'CS North Minahasa';

const CaretIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const CheckIcon = () => (
    <svg className="se-option-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default function App() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedSe, setSelectedSe] = useState<string>(ALL);
    const [activeMetric, setActiveMetric] = useState<MetricKey | null>('osa');
    const [open, setOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const handleMetric = (m: MetricKey) =>
        setActiveMetric((cur) => (cur === m ? null : m));

    useEffect(() => {
        fetch('./data.json')
            .then((r) => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(String(e)));
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (error) {
        return (
            <div className="app">
                <div className="error">Gagal memuat data: {error}</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="app">
                <div className="loader">Memuat dashboard…</div>
            </div>
        );
    }

    const isAll = selectedSe === ALL;
    const row = isAll ? null : data.seList.find((r) => r.seName === selectedSe) ?? null;

    const viewTotals: Totals = isAll || !row
        ? data.totals
        : {
            osaMtd: row.osaMtd,
            targetOsa: row.targetOsa,
            osaPct: row.osaPct,
            sellinMtd: row.sellinMtd,
            targetSellin: row.targetSellin,
            sellinPct: row.sellinPct,
            biometrikCount: row.bioGt1,
            biometrikPct: row.biometrikPct,
            incremental: row.incremental,
            totalRetailers: row.count,
            visitedRetailers: row.visitedRetailers,
            transactedRetailers: row.transactedRetailers,
            untransactedRetailers: row.untransactedRetailers,
        };


    const viewRetailers = isAll
        ? data.retailers
        : data.retailers.filter((r) => r.seName === selectedSe);
    const t = viewTotals;

    const osaNullCount = viewRetailers.filter((r) => r.osaMtd === 0).length;
    const sellinGte3Count = viewRetailers.filter((r) => r.sellinMtd >= 3).length;
    const bioGte1Count = viewRetailers.filter((r) => r.bioMtd >= 1).length;
    const bioNullCount = viewRetailers.filter((r) => r.bioMtd === 0).length;
    const visitGte1Count = viewRetailers.filter((r) => r.visit >= 1).length;

    const TARGET_PER_SE = 20;
    const totalTarget = 3 * TARGET_PER_SE;

    const choose = (value: string) => {
        setSelectedSe(value);
        setOpen(false);
    };

    const options = [
        { value: ALL, label: TERITORI, tag: 'Semua' },
        ...data.seList.map((r) => ({ value: r.seName, label: r.seName, tag: '' })),
    ];

    return (
        <div className="app">
            <header className="hero">
                <div className="hero-glow" />
                <div className="hero-inner">
                    <div className="brand">
                        <span className="brand-mark">A</span>
                        <div>
                            <div
                                className={'se-filter' + (open ? ' open' : '')}
                                ref={filterRef}
                            >
                                <button
                                    type="button"
                                    className="se-filter-btn"
                                    id="se-filter"
                                    aria-haspopup="listbox"
                                    aria-expanded={open}
                                    aria-label="Pilih Sales Executive"
                                    onClick={() => setOpen((v) => !v)}
                                >
                                    <span className="se-filter-label">{selectedSe === ALL ? TERITORI : selectedSe}</span>
                                    <span className="se-filter-caret"><CaretIcon /></span>
                                </button>

                                {open && (
                                    <div className="se-menu" role="listbox" aria-label="Sales Executive">
                                        {options.map((opt) => {
                                            const active = opt.value === selectedSe;
                                            return (
                                                <button
                                                    type="button"
                                                    key={opt.value}
                                                    role="option"
                                                    aria-selected={active}
                                                    className={'se-option' + (active ? ' active' : '')}
                                                    onClick={() => choose(opt.value)}
                                                >
                                                    <span>{opt.label}</span>
                                                    {opt.tag && <span className="se-option-tag">{opt.tag}</span>}
                                                    {active ? <CheckIcon /> : <span className="se-option-dot" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <p className="update-info">Update data sesuai tanggal 16 July 2026</p>
                            <p>Distributor Sales Executive · Dashboard KPI Juli</p>
                        </div>
                    </div>
                    <div className="hero-stats">
                        <div className="chip">
                            <span>PJP</span>
                            <strong className="chip-value">
                                {fmtNum(t.totalRetailers)}<span className="chip-unit">outlet</span>
                            </strong>
                        </div>
                        <div className="chip">
                            <span>OSA KPI</span>
                            <strong className="chip-value">
                                {fmtNum(t.transactedRetailers)}<span className="chip-unit">outlet</span>
                            </strong>
                        </div>
                        <div className="chip">
                            <span>OSA NULL</span>
                            <strong className="chip-value">
                                {fmtNum(t.untransactedRetailers)}<span className="chip-unit">outlet</span>
                            </strong>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container">
                <section className="kpi-grid">
                    <KpiCard
                        title="OSA KPI SE"
                        value={fmtPct(t.osaPct)}
                        sub={`${fmtNum(t.osaMtd)} / ${fmtNum(t.targetOsa)}`}
                        pct={t.osaPct}
                        accent="pink"
                        onClick={() => handleMetric('osa')}
                        active={activeMetric === 'osa'}
                        hint={`Null Transaksi : (${osaNullCount})`}
                    />
                    <KpiCard
                        title="SELLIN SP3GB SE"
                        value={fmtPct(t.sellinPct)}
                        sub={`${fmtNum(t.sellinMtd)} / ${fmtNum(t.targetSellin)}`}
                        pct={t.sellinPct}
                        accent="orange"
                        onClick={() => handleMetric('sellin')}
                        active={activeMetric === 'sellin'}
                        hint={`Sellin ≥3pcs : (${sellinGte3Count})`}
                    />
                    <KpiCard
                        title="BIOMETRIK"
                        value={fmtPct(t.biometrikPct)}
                        sub={`${fmtNum(bioGte1Count)} / ${fmtNum(t.totalRetailers)}`}
                        pct={t.biometrikPct}
                        accent="pink"
                        onClick={() => handleMetric('biometrik')}
                        active={activeMetric === 'biometrik'}
                        hint={`Null Biometrik : (${bioNullCount})`}
                    />
                    <KpiCard
                        title="INCREMENTAL"
                        value={fmtNum(t.incremental)}
                        sub={`${fmtNum(visitGte1Count)} / ${fmtNum(totalTarget)}`}
                        pct={Math.min(100, t.incremental)}
                        accent="orange"
                        onClick={() => handleMetric('incremental')}
                        active={activeMetric === 'incremental'}
                        hint={`Visit ≥1 : (${visitGte1Count})`}
                    />
                </section>

                {activeMetric && (
                    <RetailerTable
                        metric={activeMetric}
                        allRetailers={viewRetailers}
                        onClose={() => setActiveMetric(null)}
                    />
                )}
            </main>

            <footer className="foot">
                Dibangun dengan Vite · React · TypeScript — siap deploy ke Vercel
            </footer>
        </div>
    );
}
