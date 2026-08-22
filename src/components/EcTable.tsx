import React, { useState, useMemo } from 'react';
import type { SeRow } from '../types';
import { fmtNum, fmtPct } from '../calc';

type Props = {
    seList: SeRow[];
    onClose: () => void;
    currentTs: string;
    activeDay?: number;
};

type RangeOption = '1-8' | '9-16' | '17-24' | '25-31' | 'all';

export const EcTable: React.FC<Props> = ({ seList, onClose, currentTs, activeDay = 31 }) => {
    const [range, setRange] = useState<RangeOption>('all');

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
            case 'all':
                return Array.from({ length: 31 }, (_, i) => i + 1);
        }
    }, [range]);

    const totalEc = seList.reduce((sum, r) => sum + (r.ecTotal || 0), 0);
    const targetEc = seList.reduce((sum, r) => sum + (r.ecTarget || 0), 0);
    const overallPct = targetEc > 0 ? (totalEc / targetEc) * 100 : 0;

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

    const handlePrevRange = () => {
        if (range === '9-16') setRange('1-8');
        else if (range === '17-24') setRange('9-16');
        else if (range === '25-31') setRange('17-24');
    };

    const handleNextRange = () => {
        if (range === '1-8') setRange('9-16');
        else if (range === '9-16') setRange('17-24');
        else if (range === '17-24') setRange('25-31');
    };

    return (
        <section className="panel retailer-panel-wrap ec-panel-wrap">
            {/* Header Section */}
            <div className="panel-head ec-panel-head">
                <div className="ec-header-info">
                    <h2 className="panel-title">
                        EFFECTIVE CALL (EC) <span className="highlight-text">— {currentTs}</span>
                    </h2>
                    <div className="ec-summary-chips">
                        <span className="ec-summary-chip">
                            <strong>{seList.length}</strong> SE
                        </span>
                        <span className="ec-summary-chip">
                            Total: <strong>{fmtNum(totalEc)}</strong> / Target: <strong>{fmtNum(targetEc)}</strong>
                        </span>
                        <span
                            className="ec-summary-chip ec-summary-pct"
                            style={{
                                color: overallPct >= 100 ? '#4ade80' : overallPct >= 75 ? '#facc15' : '#f87171',
                                backgroundColor:
                                    overallPct >= 100
                                        ? 'rgba(74, 222, 128, 0.15)'
                                        : overallPct >= 75
                                        ? 'rgba(250, 204, 21, 0.15)'
                                        : 'rgba(248, 113, 113, 0.15)',
                            }}
                        >
                            Achievement: <strong>{fmtPct(overallPct)}</strong>
                        </span>
                    </div>
                </div>
                <button className="btn-close" onClick={onClose} aria-label="Tutup detail EC">
                    Tutup ✕
                </button>
            </div>

            {/* Date Range Selector Toolbar */}
            <div className="ec-range-toolbar">
                <div className="ec-range-pills">
                    <button
                        type="button"
                        className={`ec-range-pill ${range === 'all' ? 'active' : ''}`}
                        onClick={() => setRange('all')}
                    >
                        Semua TGL (1–31)
                    </button>
                    <button
                        type="button"
                        className={`ec-range-pill ${range === '1-8' ? 'active' : ''}`}
                        onClick={() => setRange('1-8')}
                    >
                        TGL 1–8
                    </button>
                    <button
                        type="button"
                        className={`ec-range-pill ${range === '9-16' ? 'active' : ''}`}
                        onClick={() => setRange('9-16')}
                    >
                        TGL 9–16
                    </button>
                    <button
                        type="button"
                        className={`ec-range-pill ${range === '17-24' ? 'active' : ''}`}
                        onClick={() => setRange('17-24')}
                    >
                        TGL 17–24
                    </button>
                    <button
                        type="button"
                        className={`ec-range-pill ${range === '25-31' ? 'active' : ''}`}
                        onClick={() => setRange('25-31')}
                    >
                        TGL 25–31
                    </button>
                </div>
                {range !== 'all' && (
                    <div className="ec-range-nav">
                        <button
                            type="button"
                            className="ec-nav-btn"
                            disabled={range === '1-8'}
                            onClick={handlePrevRange}
                            title="Periode Sebelumnya"
                        >
                            ‹ Prev
                        </button>
                        <button
                            type="button"
                            className="ec-nav-btn"
                            disabled={range === '25-31'}
                            onClick={handleNextRange}
                            title="Periode Berikutnya"
                        >
                            Next ›
                        </button>
                    </div>
                )}
            </div>

            {/* Table Section */}
            <div className="ec-table-wrap">
                <table className="ec-table">
                    <thead>
                        <tr>
                            <th className="ec-sticky-col ec-th-se">SALES EXECUTIVE</th>
                            <th className="ec-sticky-col-target ec-th-target">TOTAL VS TARGET</th>
                            {days.map((d) => {
                                const isLocked = d > activeDay;
                                return (
                                    <th key={d} className={`ec-th-day ${isLocked ? 'ec-th-locked' : ''}`}>
                                        TGL {d}
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

                            return (
                                <tr key={r.seName + '|' + r.tsName}>
                                    <td className="ec-sticky-col ec-td-se">
                                        <div className="ec-se-name">{r.seName}</div>
                                        <small className="ec-se-ts">{r.tsName}</small>
                                    </td>
                                    <td className="ec-sticky-col-target ec-td-target">
                                        <div className="ec-target-text">
                                            <strong>{fmtNum(ecTotal)}</strong> / <small>{fmtNum(ecTarget)}</small>
                                        </div>
                                        <div
                                            className="ec-pct-badge"
                                            style={{
                                                color: ecPct >= 100 ? '#4ade80' : ecPct >= 75 ? '#facc15' : '#f87171',
                                                backgroundColor:
                                                    ecPct >= 100
                                                        ? 'rgba(74, 222, 128, 0.15)'
                                                        : ecPct >= 75
                                                        ? 'rgba(250, 204, 21, 0.15)'
                                                        : 'rgba(248, 113, 113, 0.15)',
                                            }}
                                        >
                                            {fmtPct(ecPct)}
                                        </div>
                                    </td>
                                    {days.map((d) => {
                                        const isLocked = d > activeDay;
                                        if (isLocked) {
                                            return (
                                                <td
                                                    key={d}
                                                    className="ec-td-day ec-val-locked"
                                                    title={`Tanggal ${d} belum berjalan (Data per ${activeDay} Agt)`}
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
        </section>
    );
};

export default EcTable;
