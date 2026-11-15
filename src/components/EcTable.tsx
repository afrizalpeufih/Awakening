import React, { useState, useMemo } from 'react';
import type { SeRow } from '../types';
import { fmtNum, fmtPct, calcSeEcAvg, fmtAvg } from '../calc';

type Props = {
    seList: SeRow[];
    onClose: () => void;
    currentTs: string;
    activeDay?: number;
    workingDays?: number;
};

type RangeOption = '1-8' | '9-16' | '17-24' | '25-31';

export const EcTable: React.FC<Props> = ({ seList, onClose, currentTs, activeDay = 31, workingDays = 1 }) => {
    const [range, setRange] = useState<RangeOption>('1-8');

    const days = useMemo(() => {
        switch (range) {
            case '1-8':
                return Array.from({ length: 8 }, (_, i) => i + 1);
            case '9-16':
                return Array.from({ length: 8 }, (_, i) => i + 9);
            case '17-24':
                return Array.from({ length: 8 }, (_, i) => i + 17);
            case '25-31':
                return Array.from({ length: 7 }, (_, i) => i + 25);
        }
    }, [range]);

    const totalEc = seList.reduce((sum, r) => sum + (r.ecTotal || 0), 0);
    const targetEc = seList.reduce((sum, r) => sum + (r.ecTarget || 0), 0);
    const overallPct = targetEc > 0 ? (totalEc / targetEc) * 100 : 0;
    const effectiveWorkingDays = workingDays && workingDays > 0 ? workingDays : 1;

    /** Warna Average: hijau jika > 70, merah jika <= 70 */
    const avgTone = (val: number): string => (val > 70 ? 'ec-avg-high' : 'ec-avg-low');

    const overallAvg = useMemo(() => {
        if (seList.length === 0) return 0;
        const totalAvg = seList.reduce((sum, r) => sum + calcSeEcAvg(r.ecTotal || 0, effectiveWorkingDays), 0);
        return totalAvg / seList.length;
    }, [seList, effectiveWorkingDays]);

    /**
     * Color rules per user directive:
     * - val === 0 -> RED (#f87171)
     * - val >= 6  -> GREEN (#4ade80)
     * - 1..5      -> WHITE (#ffffff)
     */
    const getCellColorClass = (val: number) => {
        if (val === 0) return 'ec-val-zero';
        if (val >= 6) return 'ec-val-high';
        return 'ec-val-mid';
    };

    const ecTone = (val: number): string =>
        val >= 100 ? 'ec-pct-good' : val >= 75 ? 'ec-pct-warn' : 'ec-pct-bad';

    const rangeOrder: RangeOption[] = ['1-8', '9-16', '17-24', '25-31'];
    const currentIndex = rangeOrder.indexOf(range);

    const handlePrev = () => {
        if (currentIndex > 0) setRange(rangeOrder[currentIndex - 1]);
    };

    const handleNext = () => {
        if (currentIndex < rangeOrder.length - 1) setRange(rangeOrder[currentIndex + 1]);
    };

    return (
        <section className="panel retailer-panel-wrap ec-panel-wrap">
            {/* Header Section */}
            <div className="panel-head ec-panel-head">
                <div className="ec-header-info">
                    <h2 className="panel-title">EFFECTIVE CALL (EC)</h2>
                    <div className="ec-ts-label">{currentTs}</div>
                    <div className="ec-summary-chips">
                        <span className="ec-summary-chip">
                            <strong>{seList.length}</strong> SE
                        </span>
                        <span className="ec-summary-chip">
                            <strong>{fmtNum(totalEc)}</strong> / <strong>{fmtNum(targetEc)}</strong>
                        </span>
                        <span className={`ec-summary-chip ec-summary-pct ${ecTone(overallPct)}`}>
                            <strong>{fmtPct(overallPct)}</strong>
                        </span>
                        <span className={`ec-summary-chip ec-summary-avg ${avgTone(overallAvg)}`}>
                            <span className="ec-avg-label">Average</span>
                            <strong>{fmtAvg(overallAvg)}</strong>
                        </span>
                    </div>
                </div>
                <button className="btn-close" onClick={onClose} aria-label="Tutup detail EC">
                    ✕
                </button>
            </div>

            {/* Date Range Selector Toolbar */}
            <div className="ec-range-toolbar">
                <div className="ec-range-pills">
                    {rangeOrder.map((r) => (
                        <button
                            key={r}
                            type="button"
                            className={`ec-range-pill ${range === r ? 'active' : ''}`}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                <div className="ec-range-nav">
                    <button
                        type="button"
                        className="ec-nav-btn"
                        disabled={currentIndex === 0}
                        onClick={handlePrev}
                        title="Periode Sebelumnya"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        className="ec-nav-btn"
                        disabled={currentIndex === rangeOrder.length - 1}
                        onClick={handleNext}
                        title="Periode Berikutnya"
                    >
                        ›
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="ec-table-wrap">
                <table className="ec-table">
                    <thead>
                        <tr>
                            <th className="ec-sticky-col ec-th-se">SE</th>
                            <th className="ec-sticky-col-target ec-th-target">TGT</th>
                            {days.map((d) => {
                                const isLocked = d > activeDay;
                                return (
                                    <th key={d} className={`ec-th-day ${isLocked ? 'ec-th-locked' : ''}`}>
                                        {d}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {seList.map((r) => {
                            const ecTotal = r.ecTotal || 0;
                            const ecTarget = r.ecTarget || 0;
                            const ecPct = r.ecPct || 0;
                            const daily = r.ecDaily || {};
                            const seAvg = calcSeEcAvg(ecTotal, effectiveWorkingDays);

                            return (
                                <tr key={r.seName + '|' + r.tsName}>
                                    <td className="ec-sticky-col ec-td-se">
                                        <div className="ec-se-name">{r.seName}</div>
                                    </td>
                                    <td className="ec-sticky-col-target ec-td-target">
                                        <div className="ec-target-text">
                                            <strong>{fmtNum(ecTotal)}</strong>
                                            <span className="ec-target-sep">/</span>
                                            <small>{fmtNum(ecTarget)}</small>
                                        </div>
                                        <div className="ec-target-badges">
                                            <span className={`ec-pct-badge ${ecTone(ecPct)}`}>
                                                {fmtPct(ecPct)}
                                            </span>
                                            <span className={`ec-pct-badge ec-avg-badge ${avgTone(seAvg)}`}>
                                                {fmtAvg(seAvg)}
                                            </span>
                                        </div>
                                    </td>
                                    {days.map((d) => {
                                        const isLocked = d > activeDay;
                                        if (isLocked) {
                                            return (
                                                <td
                                                    key={d}
                                                    className="ec-td-day ec-val-locked"
                                                    title={`Tanggal ${d} belum berjalan (Data per tanggal ${activeDay})`}
                                                >
                                                    -
                                                </td>
                                            );
                                        }

                                        const val = Number((daily as Record<string | number, number>)[d] ?? 0);
                                        const colorClass = getCellColorClass(val);
                                        return (
                                            <td key={d} className={`ec-td-day ${colorClass}`}>
                                                {val}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Scroll hint */}
            <div className="ec-mobile-hint">
                ← Geser tabel untuk melihat tanggal lainnya
            </div>
        </section>
    );
};

export default EcTable;
