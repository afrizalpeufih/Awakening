import { useEffect, useRef, useState } from 'react';
import type { DashboardData, Totals } from './types';
import KpiCard from './components/KpiCard';
import RetailerTable from './components/RetailerTable';
import type { MetricKey } from './components/RetailerTable';
import EcTable from './components/EcTable';
import LandingPage from './components/LandingPage';
import { UploadModal } from './components/UploadModal';
import { getUploadHistory, loadHistoryItemData } from './supabaseDb';
import { fmtNum, fmtPct, slugify, MONTH_MAP, parseFileDate, computeMetricPcts } from './calc';

export type ExtendedMetricKey = MetricKey | 'ec';

const ALL = 'AWAKENING';
const DEFAULT_TERRITORY = 'CS North Minahasa';

/** Parse tanggal dari nama file sumber, misal "UPDATE 31 JULI.xlsx" => "Update data : 31 July 2026" */
function parseUpdateLabel(source: string): string {
    if (!source) return '';
    const clean = source.replace(/\.[^/.]+$/, '').trim();
    const m = clean.match(/(?:UPDATE\s+)?(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/i);
    if (!m) return clean.startsWith('Update') ? clean : `Update data : ${clean}`;
    const day = m[1];
    const monthRaw = m[2].toUpperCase();
    const year = m[3] || '2026';
    const monthEng = MONTH_MAP[monthRaw] || monthRaw;
    return `Update data : ${day} ${monthEng} ${year}`;
}

/** Parse active day number from file source or update label (e.g. "20 August 2026" => 20) */
function parseActiveDay(sourceOrLabel?: string): number {
    if (!sourceOrLabel) return 31;
    const m = sourceOrLabel.match(/(?:UPDATE\s+|Update\s+data\s*:\s*)?(\d{1,2})\s+[A-Za-z]{3,}/i);
    if (m) {
        const day = parseInt(m[1], 10);
        if (day >= 1 && day <= 31) return day;
    }
    return 31;
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
    const [activeMetric, setActiveMetric] = useState<ExtendedMetricKey | null>('osa');
    const [open, setOpen] = useState(false);
    const [updateLabel, setUpdateLabel] = useState<string>('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
    const [prevData, setPrevData] = useState<DashboardData | null>(null);
    const [prevFileName, setPrevFileName] = useState<string | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);

    const handleMetric = (m: ExtendedMetricKey) =>
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
        // Cek data terbaru dari database & storage Supabase terlebih dahulu
        const loadInitial = async () => {
            try {
                const historyItems = await getUploadHistory();
                if (historyItems && historyItems.length > 0) {
                    const activeItem = historyItems.find((item) => item.isActive) || historyItems[0];
                    if (activeItem) {
                        const fullData = await loadHistoryItemData(activeItem);
                        if (fullData) {
                            // If cached Supabase data is missing ecDaily, enrich from local data.json
                            if (!fullData.seList[0]?.ecDaily) {
                                try {
                                    const localRes = await fetch('./data.json');
                                    if (localRes.ok) {
                                        const localData = await localRes.json();
                                        if (localData.seList[0]?.ecDaily) {
                                            const ecMap = new Map(localData.seList.map((s: any) => [s.seName, s.ecDaily]));
                                            fullData.seList = fullData.seList.map((s: any) => ({
                                                ...s,
                                                ecDaily: ecMap.get(s.seName) || s.ecDaily,
                                            }));
                                        }
                                    }
                                } catch {
                                    // ignore fallback error
                                }
                            }
                            setData(fullData);
                            setActiveHistoryId(activeItem.id);
                            setUpdateLabel(parseUpdateLabel(activeItem.fileName || fullData.source || ''));
                            applyRouting(fullData);
                            return;
                        }
                    }
                }
                throw new Error('Tidak ada riwayat aktif di Supabase');
            } catch (err) {
                console.log('[Supabase] Fallback ke data.json default...');
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
            }
        };

        loadInitial();
    }, []);

    // Resolve & muat dataset upload sebelumnya untuk perhitungan growth
    useEffect(() => {
        let cancelled = false;
        const resolvePrev = async () => {
            setPrevData(null);
            setPrevFileName(null);
            try {
                const items = await getUploadHistory();
                if (!items || items.length === 0) return;

                // Urutkan berdasarkan tanggal dari nama file (fallback: waktu upload)
                const sorted = [...items].sort((a, b) => {
                    const ta = parseFileDate(a.fileName);
                    const tb = parseFileDate(b.fileName);
                    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
                    return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
                });

                const idx = sorted.findIndex((c) => c.id === activeHistoryId);
                // Tanggal file aktif: dari item aktif, atau label update yang sedang tampil
                const activeDate = parseFileDate(
                    sorted.find((c) => c.id === activeHistoryId)?.fileName || updateLabel || ''
                );

                let prev: typeof sorted[number] | undefined;
                if (activeDate !== null) {
                    // Cari snapshot dengan tanggal file paling dekat di bawah tanggal aktif
                    for (const c of [...sorted].reverse()) {
                        if (c.id === activeHistoryId) continue;
                        const t = parseFileDate(c.fileName);
                        if (t !== null && t < activeDate) {
                            prev = c;
                            break;
                        }
                    }
                }
                // Fallback urutan: item tepat sebelum item aktif dalam daftar terurut
                if (!prev && idx > 0) {
                    prev = sorted[idx - 1];
                }

                if (!prev || cancelled) return;
                const d = await loadHistoryItemData(prev);
                if (!cancelled && d) {
                    setPrevData(d);
                    setPrevFileName(prev.fileName);
                }
            } catch {
                // Growth bersifat opsional: abaikan kegagalan fetch riwayat
            }
        };
        resolvePrev();
        return () => {
            cancelled = true;
        };
    }, [activeHistoryId, data, updateLabel]);

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
        const targetGrossAd = territorySeRows.reduce((s, r) => s + (r.targetGrossAd ?? r.targetSellin), 0);
        const sellinPct = targetSellin > 0 ? (sellinMtd / targetSellin) * 100 : 0;
        const bioGt1 = territoryRetailers.filter((r) => r.bioMtd > 1).length;
        const biometrikPct = totalRetailers > 0 ? (bioGt1 / totalRetailers) * 100 : 0;
        const incremental = territorySeRows.reduce((s, r) => s + r.incremental, 0);
        const visitedRetailers = territoryRetailers.filter((r) => r.visit >= 1).length;
        const transactedRetailers = territoryRetailers.filter((r) => r.osaMtd !== 0).length;
        const untransactedRetailers = totalRetailers - transactedRetailers;

        const targetIncremental = territorySeRows.reduce((s, r) => s + (r.targetIncremental || 40), 0);
        const targetVisit = territorySeRows.reduce((s, r) => s + (r.targetVisit || 20), 0);

        const ecTotal = territorySeRows.reduce((s, r) => s + (r.ecTotal || 0), 0);
        const ecTarget = territorySeRows.reduce((s, r) => s + (r.ecTarget || 0), 0);
        const ecPct = ecTarget > 0 ? (ecTotal / ecTarget) * 100 : 0;

        viewTotals = {
            osaMtd,
            targetOsa,
            osaPct,
            sellinMtd,
            targetSellin,
            targetGrossAd,
            sellinPct,
            biometrikCount: bioGt1,
            biometrikPct,
            incremental,
            targetIncremental,
            targetVisit,
            totalRetailers,
            visitedRetailers,
            transactedRetailers,
            untransactedRetailers,
            ecTotal,
            ecTarget,
            ecPct,
        };
    } else if (row) {
        viewTotals = {
            osaMtd: row.osaMtd,
            targetOsa: row.targetOsa,
            osaPct: row.osaPct,
            sellinMtd: row.sellinMtd,
            targetSellin: row.targetSellin,
            targetGrossAd: row.targetGrossAd ?? row.targetSellin,
            sellinPct: row.sellinPct,
            biometrikCount: row.bioGt1,
            biometrikPct: row.biometrikPct,
            incremental: row.incremental,
            targetIncremental: row.targetIncremental || 40,
            targetVisit: row.targetVisit || 20,
            totalRetailers: row.count,
            visitedRetailers: row.visitedRetailers,
            transactedRetailers: row.transactedRetailers,
            untransactedRetailers: row.untransactedRetailers,
            ecTotal: row.ecTotal || 0,
            ecTarget: row.ecTarget || 0,
            ecPct: row.ecPct || 0,
        };
        viewRetailers = territoryRetailers.filter((r) => r.seName === selectedSe);
    } else {
        viewTotals = data.totals;
    }

    const t = viewTotals;

    const osaNullCount = viewRetailers.filter((r) => r.osaMtd === 0).length;
    const sellinGte5Count = viewRetailers.filter((r) => r.sellinMtd >= 5).length;
    const sellinNullCount = viewRetailers.filter((r) => r.sellinMtd === 0).length;
    const bioNullCount = viewRetailers.filter((r) => r.bioMtd === 0).length;
    const qssoCount = viewRetailers.filter((r) => r.bioMtd >= 3).length;
    // GrossAd achieve = total semua Biometrik MTD (bukan hitungan retailer)
    const grossAdAchieve = viewRetailers.reduce((s, r) => s + r.bioMtd, 0);
    const targetGrossAd = t.targetGrossAd ?? t.targetSellin;
    // Nilai utama BIOMETRIK = persentase GrossAd (grossAdAchieve / targetGrossAd)
    const bioPct = targetGrossAd > 0 ? (grossAdAchieve / targetGrossAd) * 100 : 0;
    // Total visit = jumlah seluruh visit (tanpa memperdulikan besar/kecilnya)
    const totalVisit = viewRetailers.reduce((s, r) => s + r.visit, 0);
    const visitPct = t.targetVisit > 0 ? ((totalVisit / t.targetVisit) * 100).toFixed(1) : '0.0';

    const gapOsa = t.targetOsa - t.osaMtd;
    const gapOsaPct = t.targetOsa > 0 ? ((gapOsa / t.targetOsa) * 100).toFixed(1) : '0.0';
    const achievementOsaPct = t.targetOsa > 0 ? ((t.osaMtd / t.targetOsa) * 100).toFixed(1) : '0.0';

    const incrementalTarget = isAll
        ? territorySeRows.reduce((sum, r) => sum + (r.targetIncremental || 40), 0)
        : (territorySeRows.find((r) => r.seName === selectedSe)?.targetIncremental || 40);
    const incrementalGap = incrementalTarget - t.incremental;
    const incrementalPct = incrementalTarget > 0
        ? (t.incremental / incrementalTarget) * 100
        : 0;

    // ── Growth vs data upload sebelumnya ─────────────────────────────
    let growthOsa: number | null = null;
    let growthSellin: number | null = null;
    let growthBio: number | null = null;
    let growthInc: number | null = null;
    if (prevData) {
        const cur = computeMetricPcts(data, currentTs, selectedSe);
        const prev = computeMetricPcts(prevData, currentTs, selectedSe);
        growthOsa = cur.osa - prev.osa;
        growthSellin = cur.sellin - prev.sellin;
        growthBio = cur.bio - prev.bio;
        growthInc = cur.inc - prev.inc;
        // Angka sangat kecil (pembulatan floating point) dianggap 0
        const snap = (v: number) => (Math.abs(v) < 0.05 ? 0 : v);
        growthOsa = snap(growthOsa);
        growthSellin = snap(growthSellin);
        growthBio = snap(growthBio);
        growthInc = snap(growthInc);
    }
    const prevLabelShort = prevFileName
        ? parseUpdateLabel(prevFileName).replace(/^Update data :\s*/i, '')
        : undefined;

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
                        <div
                            className={`chip chip-clickable ${activeMetric === 'ec' ? 'active' : ''}`}
                            onClick={() => handleMetric('ec')}
                            title={`Klik untuk melihat detail pencapaian Effective Call (Total: ${fmtNum(t.ecTotal || 0)} / Target: ${fmtNum(t.ecTarget || 0)})`}
                        >
                            <span>EC</span>
                            <strong className="chip-value">
                                {fmtPct(t.ecPct || 0)}
                            </strong>
                        </div>
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
                <section className={'kpi-grid' + (activeMetric === 'ec' ? ' kpi-grid-hidden' : '')}>
                    <KpiCard
                        title="OSA KPI SE"
                        value={fmtPct(t.osaPct)}
                        pct={t.osaPct}
                        accent="pink"
                        onClick={() => handleMetric('osa')}
                        active={activeMetric === 'osa'}
                        hint={`Null Transaksi : (${osaNullCount})`}
                        subLabels={[
                            { label: 'Achieve', count: t.osaMtd, total: t.targetOsa, showTotal: false, format: 'accounting', pct: achievementOsaPct },
                            { label: 'GAP', count: gapOsa, total: t.targetOsa, showTotal: false, format: 'accounting', pct: gapOsaPct, signed: true },
                        ]}
                        growth={{ delta: growthOsa, prevLabel: prevLabelShort }}
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
                            { label: 'Achieve', count: t.sellinMtd, total: t.targetSellin },
                            { label: 'Retailer 5pcs', count: sellinGte5Count, total: t.totalRetailers },
                        ]}
                        growth={{ delta: growthSellin, prevLabel: prevLabelShort }}
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
                            { label: 'GrossAd', count: grossAdAchieve, total: targetGrossAd },
                            { label: 'Retailer QSSO', count: qssoCount, total: t.totalRetailers },
                        ]}
                        growth={{ delta: growthBio, prevLabel: prevLabelShort }}
                    />
                    <KpiCard
                        title="INCREMENTAL"
                        value={fmtPct(incrementalPct)}
                        pct={incrementalPct}
                        accent="orange"
                        onClick={() => handleMetric('incremental')}
                        active={activeMetric === 'incremental'}
                        hint={`Visit 1,5 Jam : ${totalVisit}/${t.targetVisit} (${visitPct}%)`}
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
                                signed: true,
                                pct: incrementalTarget > 0
                                    ? ((incrementalGap / incrementalTarget) * 100).toFixed(1)
                                    : '0.0',
                            },
                        ]}
                        growth={{ delta: growthInc, prevLabel: prevLabelShort }}
                    />
                </section>

                {activeMetric === 'ec' && (
                    <EcTable
                        seList={selectedSe === ALL ? territorySeRows : territorySeRows.filter((r) => r.seName === selectedSe)}
                        onClose={() => setActiveMetric(null)}
                        currentTs={selectedSe === ALL ? currentTs : `${selectedSe} (${currentTs})`}
                        activeDay={parseActiveDay(updateLabel || data.source)}
                    />
                )}

                {activeMetric && activeMetric !== 'ec' && (
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
