import { useEffect, useRef, useState } from 'react';
import type { DashboardData, Totals } from './types';
import KpiCard from './components/KpiCard';
import RetailerTable from './components/RetailerTable';
import type { MetricKey } from './components/RetailerTable';
import LandingPage from './components/LandingPage';
import { UploadModal } from './components/UploadModal';
import { getUploadHistory, loadHistoryItemData } from './supabaseDb';
import { fmtNum, fmtPct } from './calc';

const ALL = 'AWAKENING';
const DEFAULT_TERRITORY = 'CS North Minahasa';

const slugify = (text: string): string =>
    text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

/** Parse tanggal dari nama file sumber, misal "UPDATE 31 JULI.xlsx" => "Update data : 31 July 2026" */
function parseUpdateLabel(source: string): string {
    if (!source) return '';
    const clean = source.replace(/\.[^/.]+$/, '').trim();
    const m = clean.match(/(?:UPDATE\s+)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/i);
    if (!m) return clean.startsWith('Update') ? clean : `Update data : ${clean}`;
    const day = m[1];
    const monthRaw = m[2].toUpperCase();
    const year = m[3] || '2026';
    const months: Record<string, string> = {
        JANUARI: 'January', JAN: 'January', JANUARY: 'January',
        FEBRUARI: 'February', FEB: 'February', FEBRUARY: 'February',
        MARET: 'March', MAR: 'March', MARCH: 'March',
        APRIL: 'April', APR: 'April',
        MEI: 'May', MAY: 'May',
        JUNI: 'June', JUN: 'June', JUNE: 'June',
        JULI: 'July', JUL: 'July', JULY: 'July',
        AGUSTUS: 'August', AGUS: 'August', AGT: 'August', AUG: 'August', AUGUST: 'August',
        SEPTEMBER: 'September', SEP: 'September',
        OKTOBER: 'October', OKT: 'October', OCT: 'October', OCTOBER: 'October',
        NOVEMBER: 'November', NOV: 'November',
        DESEMBER: 'December', DES: 'December', DEC: 'December', DECEMBER: 'December',
    };
    const monthEng = months[monthRaw] || monthRaw;
    return `Update data : ${day} ${monthEng} ${year}`;
}

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
    const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');
    const [selectedTs, setSelectedTs] = useState<string | null>(null);
    const [selectedSe, setSelectedSe] = useState<string>(ALL);
    const [activeMetric, setActiveMetric] = useState<MetricKey | null>('osa');
    const [open, setOpen] = useState(false);
    const [updateLabel, setUpdateLabel] = useState<string>('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    const handleMetric = (m: MetricKey) =>
        setActiveMetric((cur) => (cur === m ? null : m));

    const applyRouting = (d: DashboardData) => {
        const path = window.location.pathname.replace(/^\/+/, '');
        if (path && path !== 'index.html') {
            const allTs = Array.from(new Set(d.seList.map((r) => r.tsName)));
            const foundTs = allTs.find((ts) => slugify(ts) === path);
            if (foundTs) {
                setSelectedTs(foundTs);
                setViewMode('dashboard');
            } else {
                setViewMode('landing');
            }
        } else {
            setViewMode('landing');
        }
    };

    useEffect(() => {
        // Cek data terbaru dari database Supabase terlebih dahulu
        getUploadHistory()
            .then(async (historyItems) => {
                if (historyItems && historyItems.length > 0) {
                    const activeItem = historyItems.find((item) => item.isActive) || historyItems[0];
                    if (activeItem) {
                        // Load data from Storage (cross-device sync)
                        const data = await loadHistoryItemData(activeItem);
                        if (data) {
                            setData(data);
                            setActiveHistoryId(activeItem.id);
                            setUpdateLabel(parseUpdateLabel(activeItem.fileName || data.source || ''));
                            applyRouting(data);
                            return;
                        }
                    }
                }
                throw new Error('Tidak ada riwayat di Supabase');
            })
            .catch(() => {
                // Fallback ke data.json lokal jika Supabase kosong / offline
                fetch('./data.json')
                    .then((r) => {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                    })
                    .then((d: DashboardData) => {
                        setData(d);
                        setUpdateLabel(parseUpdateLabel(d.source || ''));
                        applyRouting(d);
                    })
                    .catch((e) => setError(String(e)));
            });
    }, []);

    useEffect(() => {
        const onPopState = () => {
            const path = window.location.pathname.replace(/^\/+/, '');
            if (!path || path === 'index.html') {
                setViewMode('landing');
                setSelectedTs(null);
            } else if (data) {
                const allTs = Array.from(new Set(data.seList.map((r) => r.tsName)));
                const foundTs = allTs.find((ts) => slugify(ts) === path);
                if (foundTs) {
                    setSelectedTs(foundTs);
                    setViewMode('dashboard');
                } else {
                    setViewMode('landing');
                }
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [data]);

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

    const handleDataLoaded = (newData: DashboardData, fileName?: string, historyId?: string) => {
        setData(newData);
        if (fileName || newData.source) {
            setUpdateLabel(parseUpdateLabel(fileName || newData.source || ''));
        }
        if (historyId) {
            setActiveHistoryId(historyId);
        }
    };

    const handleSelectTs = (tsName: string) => {
        const slug = slugify(tsName);
        window.history.pushState({}, '', `/${slug}`);
        setSelectedTs(tsName);
        setSelectedSe(ALL);
        setViewMode('dashboard');
    };

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
                <div className="loader">Memuat data dari database Supabase…</div>
            </div>
        );
    }

    if (viewMode === 'landing') {
        return (
            <>
                <LandingPage
                    data={data}
                    onDataLoaded={handleDataLoaded}
                    activeHistoryId={activeHistoryId}
                    onSelectTs={handleSelectTs}
                />
                <UploadModal
                    isOpen={isUploadModalOpen}
                    onClose={() => setIsUploadModalOpen(false)}
                    onDataLoaded={handleDataLoaded}
                    activeHistoryId={activeHistoryId}
                />
            </>
        );
    }

    // DASHBOARD VIEW
    const currentTs = selectedTs || DEFAULT_TERRITORY;
    const territorySeRows = data.seList.filter((r) => r.tsName === currentTs);
    const territoryRetailers = data.retailers.filter((r) => r.tsName === currentTs);

    const isAll = selectedSe === ALL;
    const row = isAll ? null : territorySeRows.find((r) => r.seName === selectedSe) ?? null;

    let viewTotals: Totals;
    let viewRetailers = territoryRetailers;

    if (isAll) {
        const totalRetailers = territoryRetailers.length;
        const osaMtd = territoryRetailers.reduce((s, r) => s + r.osaMtd, 0);
        const targetOsa = territorySeRows.reduce((s, r) => s + r.targetOsa, 0);
        const osaPct = targetOsa > 0 ? (osaMtd / targetOsa) * 100 : 0;
        const sellinMtd = territoryRetailers.reduce((s, r) => s + r.sellinMtd, 0);
        const targetSellin = territorySeRows.reduce((s, r) => s + r.targetSellin, 0);
        const sellinPct = targetSellin > 0 ? (sellinMtd / targetSellin) * 100 : 0;
        const bioGt1 = territoryRetailers.filter((r) => r.bioMtd >= 1).length;
        const biometrikPct = totalRetailers > 0 ? (bioGt1 / totalRetailers) * 100 : 0;
        const incremental = territorySeRows.reduce((s, r) => s + r.incremental, 0);
        const visitedRetailers = territoryRetailers.filter((r) => r.visit >= 1).length;
        const transactedRetailers = territoryRetailers.filter((r) => r.osaMtd !== 0).length;
        const untransactedRetailers = totalRetailers - transactedRetailers;

        viewTotals = {
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
            visitedRetailers,
            transactedRetailers,
            untransactedRetailers,
        };
    } else if (row) {
        viewTotals = {
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
        viewRetailers = territoryRetailers.filter((r) => r.seName === selectedSe);
    } else {
        viewTotals = data.totals;
    }

    const t = viewTotals;

    const osaNullCount = viewRetailers.filter((r) => r.osaMtd === 0).length;
    const sellinGte3Count = viewRetailers.filter((r) => r.sellinMtd >= 3).length;
    const sellinNullCount = viewRetailers.filter((r) => r.sellinMtd === 0).length;
    const bioGte1Count = viewRetailers.filter((r) => r.bioMtd >= 1).length;
    const bioNullCount = viewRetailers.filter((r) => r.bioMtd === 0).length;
    const telcoRetailers = viewRetailers.filter((r) => r.type !== 'Outlet Non-Telco');
    const telcoBioCount = telcoRetailers.filter((r) => r.bioMtd >= 1).length;
    const qssoCount = viewRetailers.filter((r) => r.bioMtd >= 3).length;
    const bioPct = t.totalRetailers > 0 ? (bioGte1Count / t.totalRetailers) * 100 : 0;
    const visitGte1Count = viewRetailers.filter((r) => r.visit >= 1).length;

    const gapOsa = t.targetOsa - t.osaMtd;
    const gapOsaPct = t.targetOsa > 0 ? ((gapOsa / t.targetOsa) * 100).toFixed(1) : '0.0';
    const achievementOsaPct = t.targetOsa > 0 ? ((t.osaMtd / t.targetOsa) * 100).toFixed(1) : '0.0';

    const INCREMENTAL_TARGET_PER_SE = 40;
    const incrementalTarget = isAll
        ? (territorySeRows.length || 1) * INCREMENTAL_TARGET_PER_SE
        : INCREMENTAL_TARGET_PER_SE;
    const incrementalGap = incrementalTarget - t.incremental;
    const incrementalPct = incrementalTarget > 0
        ? (t.incremental / incrementalTarget) * 100
        : 0;

    const choose = (value: string) => {
        setSelectedSe(value);
        setOpen(false);
    };

    const options = [
        { value: ALL, label: currentTs, tag: 'Semua' },
        ...territorySeRows.map((r) => ({ value: r.seName, label: r.seName, tag: '' })),
    ];

    return (
        <div className="app">
            <header className="hero">
                <div className="hero-glow" />
                <div className="hero-inner">
                    <div className="brand">
                        <span
                            className="brand-mark brand-mark-clickable"
                            onClick={() => setIsUploadModalOpen(true)}
                            title="Klik untuk Upload File Excel & Riwayat Data"
                        >
                            A
                        </span>
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
                                        <span className="se-filter-label">{selectedSe === ALL ? currentTs : selectedSe}</span>
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
                                {updateLabel && <p className="update-label">{updateLabel}</p>}
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
                        pct={t.osaPct}
                        accent="pink"
                        onClick={() => handleMetric('osa')}
                        active={activeMetric === 'osa'}
                        hint={`Null Transaksi : (${osaNullCount})`}
                        subLabels={[
                            { label: 'Achievement', count: t.osaMtd, total: t.targetOsa, showTotal: false, format: 'accounting', pct: achievementOsaPct },
                            { label: 'GAP', count: gapOsa, total: t.targetOsa, showTotal: false, format: 'accounting', pct: gapOsaPct },
                        ]}
                    />
                    <KpiCard
                        title="SELLIN SP3GB SE"
                        value={fmtPct(t.sellinPct)}
                        pct={t.sellinPct}
                        accent="orange"
                        onClick={() => handleMetric('sellin')}
                        active={activeMetric === 'sellin'}
                        hint={`Null Sellin : (${sellinNullCount})`}
                        subLabels={[
                            { label: 'Achievement', count: t.sellinMtd, total: t.targetSellin },
                            { label: 'Retailer 3pcs', count: sellinGte3Count, total: t.totalRetailers },
                        ]}
                    />
                    <KpiCard
                        title="BIOMETRIK"
                        value={fmtPct(bioPct)}
                        pct={bioPct}
                        accent="pink"
                        onClick={() => handleMetric('biometrik')}
                        active={activeMetric === 'biometrik'}
                        hint={`Null Biometrik : (${bioNullCount})`}
                        subLabels={[
                            { label: 'Telco', count: telcoBioCount, total: telcoRetailers.length },
                            { label: 'Retailer QSSO', count: qssoCount, total: t.totalRetailers },
                        ]}
                    />
                    <KpiCard
                        title="INCREMENTAL"
                        value={fmtPct(incrementalPct)}
                        pct={incrementalPct}
                        accent="orange"
                        onClick={() => handleMetric('incremental')}
                        active={activeMetric === 'incremental'}
                        hint={`Visit ≥1 : (${visitGte1Count})`}
                        subLabels={[
                            {
                                label: 'Incremental',
                                count: t.incremental,
                                total: incrementalTarget,
                                format: 'ratio',
                                showTotal: false,
                                pct: incrementalTarget > 0
                                    ? ((t.incremental / incrementalTarget) * 100).toFixed(1)
                                    : '0.0',
                            },
                            {
                                label: 'GAP',
                                count: incrementalGap,
                                total: incrementalTarget,
                                format: 'ratio',
                                showTotal: false,
                                pct: incrementalTarget > 0
                                    ? ((incrementalGap / incrementalTarget) * 100).toFixed(1)
                                    : '0.0',
                            },
                        ]}
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

            <UploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onDataLoaded={handleDataLoaded}
                activeHistoryId={activeHistoryId}
            />
        </div>
    );
}
