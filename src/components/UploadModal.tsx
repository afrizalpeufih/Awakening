import React, { useEffect, useRef, useState } from 'react';
import type { DashboardData } from '../types';
import { parseExcelWorkbook } from '../excelParser';
import type { HistoryItem } from '../historyDb';
import {
    getUploadHistory,
    saveUploadToHistory,
    deleteHistoryItem,
    setActiveHistoryId,
} from '../supabaseDb';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDataLoaded: (data: DashboardData, labelOverride?: string, historyId?: string) => void;
    activeHistoryId?: string | null;
}

type ViewMode = 'history' | 'management' | 'password';

export const UploadModal: React.FC<UploadModalProps> = ({
    isOpen,
    onClose,
    onDataLoaded,
    activeHistoryId,
}) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('history');
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const expectedPassword = (import.meta.env.VITE_UPLOAD_PASSWORD || 'm4n4m4n4').trim();

    useEffect(() => {
        if (isOpen) {
            // Reset ke history view setiap kali modal dibuka
            setViewMode('history');
            setPasswordInput('');
            setPasswordError(null);
            setError(null);
            setSuccessMsg(null);
            
            // Debug: Log Supabase configuration
            console.log('[DEBUG] Fetching upload history...');
            console.log('[DEBUG] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
            console.log('[DEBUG] Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
            
            getUploadHistory()
                .then((items) => {
                    console.log('[DEBUG] Fetched items:', items.length, items);
                    setHistory(items);
                    
                    if (items.length === 0) {
                        setDebugInfo('⚠️ Tidak ada data ditemukan. Pastikan Supabase terkonfigurasi dengan benar dan table upload_history memiliki data.');
                    } else {
                        setDebugInfo(`✓ Berhasil memuat ${items.length} riwayat file dari database.`);
                    }
                })
                .catch((err) => {
                    console.error('[DEBUG] Error fetching history:', err);
                    setError(`Gagal memuat riwayat: ${err.message || err}`);
                    setDebugInfo(`❌ Error: ${err.message || err}`);
                });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput.trim() === expectedPassword) {
            // Password benar, masuk ke management mode
            setViewMode('management');
            setPasswordError(null);
            setPasswordInput('');
        } else {
            setPasswordError('Password salah! Silakan coba lagi.');
        }
    };

    const handleManagementClick = () => {
        setViewMode('password');
        setPasswordError(null);
        setError(null);
        setSuccessMsg(null);
    };

    const handleBackToHistory = () => {
        setViewMode('history');
        setPasswordInput('');
        setPasswordError(null);
        setError(null);
        setSuccessMsg(null);
    };

    const handleHistoryItemClick = async (item: HistoryItem) => {
        // Langsung restore data tanpa masuk detail
        setError(null);
        await setActiveHistoryId(item.id);
        onDataLoaded(item.data, item.fileName, item.id);
        setSuccessMsg(`Data berhasil dimuat dari file: "${item.fileName}"!`);
        
        // Refresh history list
        const updatedHistory = await getUploadHistory();
        setHistory(updatedHistory);
        
        // Tutup modal setelah 1 detik
        setTimeout(() => {
            onClose();
        }, 1000);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const buffer = await file.arrayBuffer();
            const parsedData = parseExcelWorkbook(buffer, file.name);
            const savedItem = await saveUploadToHistory(file, parsedData);
            const updatedHistory = await getUploadHistory();

            setHistory(updatedHistory);
            onDataLoaded(parsedData, file.name, savedItem.id);
            setSuccessMsg(`File "${file.name}" berhasil diunggah & data dashboard telah diperbarui!`);
        } catch (err: any) {
            setError(err?.message || 'Gagal memproses file Excel.');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRestore = async (item: HistoryItem) => {
        setError(null);
        await setActiveHistoryId(item.id);
        onDataLoaded(item.data, item.fileName, item.id);
        setSuccessMsg(`Data berhasil di-restore ke versi file: "${item.fileName}"!`);
        
        // Refresh history list
        const updatedHistory = await getUploadHistory();
        setHistory(updatedHistory);
        
        // Clear success message after 1.5 seconds
        setTimeout(() => {
            setSuccessMsg(null);
        }, 1500);
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        const item = history.find(h => h.id === id);
        const confirmMsg = item 
            ? `Hapus riwayat file "${item.fileName}"?`
            : 'Hapus riwayat file ini?';
            
        if (!confirm(confirmMsg)) return;
        
        const updated = await deleteHistoryItem(id);
        setHistory(updated);
        
        if (activeHistoryId === id) {
            setSuccessMsg('Riwayat data aktif telah dihapus.');
        }
    };

    const formatTime = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return isoString;
        }
    };

    // Render konten berdasarkan viewMode
    const renderContent = () => {
        // PASSWORD VIEW: Form password untuk akses management
        if (viewMode === 'password') {
            return (
                <>
                    <div className="modal-header">
                        <button className="btn-back" onClick={handleBackToHistory} aria-label="Kembali">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        <div className="modal-header-brand">
                            <span className="modal-mark">A</span>
                            <div>
                                <h3 className="modal-title">Kelola Data & Upload File</h3>
                                <p className="modal-subtitle">Masukkan password untuk melanjutkan</p>
                            </div>
                        </div>
                        <button className="btn-close-modal" onClick={onClose} aria-label="Tutup">
                            ✕
                        </button>
                    </div>

                    <div className="modal-body">
                        <div className="password-protection-box">
                            <div className="lock-icon-wrapper">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <h4 className="password-title">Akses Terkunci</h4>
                            <p className="password-subtitle">Masukkan password keamanan untuk dapat mengunggah file atau mengelola data</p>

                            {passwordError && <div className="modal-alert modal-alert-error">{passwordError}</div>}

                            <form onSubmit={handlePasswordSubmit} className="password-form">
                                <input
                                    type="password"
                                    className="password-input"
                                    placeholder="Masukkan password..."
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    autoFocus
                                />
                                <button type="submit" className="btn-submit-password">
                                    Buka Akses
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            );
        }

        // MANAGEMENT VIEW: Upload & manage files dengan full access
        if (viewMode === 'management') {
            return (
                <>
                    <div className="modal-header">
                        <button className="btn-back" onClick={handleBackToHistory} aria-label="Kembali">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        <div className="modal-header-brand">
                            <span className="modal-mark">A</span>
                            <div>
                                <h3 className="modal-title">Kelola Data & Upload File</h3>
                                <p className="modal-subtitle">Upload update Excel terbaru atau kelola riwayat data</p>
                            </div>
                        </div>
                        <button className="btn-close-modal" onClick={onClose} aria-label="Tutup">
                            ✕
                        </button>
                    </div>

                    <div className="modal-body">
                        {error && <div className="modal-alert modal-alert-error">{error}</div>}
                        {successMsg && <div className="modal-alert modal-alert-success">{successMsg}</div>}

                        {/* Upload Section */}
                        <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".xlsx, .xls"
                                style={{ display: 'none' }}
                            />
                            <div className="dropzone-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <div className="dropzone-text">
                                <strong>{uploading ? 'Memproses File...' : 'Klik untuk Unggah File Excel (.xlsx)'}</strong>
                                <span>Format sesuai struktur sheet "DATA" & "TARGET"</span>
                            </div>
                        </div>

                        {/* History Section */}
                        <div className="history-section">
                            <h4 className="history-title">Riwayat Upload File</h4>
                            {history.length === 0 ? (
                                <div className="history-empty">Belum ada riwayat upload file tersimpan.</div>
                            ) : (
                                <div className="history-list">
                                    {history.map((item) => {
                                        const isCurrent = activeHistoryId === item.id;
                                        return (
                                            <div
                                                key={item.id}
                                                className={`history-item ${isCurrent ? 'active' : ''}`}
                                            >
                                                <div className="history-item-info">
                                                    <div className="history-item-name">
                                                        <span>{item.fileName}</span>
                                                        {isCurrent && <span className="badge-active">Aktif</span>}
                                                    </div>
                                                    <div className="history-item-date">{formatTime(item.uploadedAt)}</div>
                                                </div>
                                                <div className="history-item-actions">
                                                    {!isCurrent && (
                                                        <button
                                                            className="btn-restore"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRestore(item);
                                                            }}
                                                            title="Restore ke versi ini"
                                                        >
                                                            Restore
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn-delete-history"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(item.id, e);
                                                        }}
                                                        title="Hapus dari riwayat"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            );
        }

        // HISTORY VIEW (Default): Tampilkan history tanpa password
        return (
            <>
                <div className="modal-header">
                    <div className="modal-header-brand">
                        <span className="modal-mark">A</span>
                        <div>
                            <h3 className="modal-title">History of Data</h3>
                            <p className="modal-subtitle">Pilih data yang ingin dimuat ke dashboard</p>
                        </div>
                    </div>
                    <div className="modal-header-actions">
                        <button 
                            className="btn-home-modal" 
                            onClick={() => window.location.href = '/'} 
                            aria-label="Home"
                            title="Kembali ke Landing Page"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                        </button>
                        <button className="btn-close-modal" onClick={onClose} aria-label="Tutup">
                            ✕
                        </button>
                    </div>
                </div>

                <div className="modal-body">
                    {error && <div className="modal-alert modal-alert-error">{error}</div>}
                    {successMsg && <div className="modal-alert modal-alert-success">{successMsg}</div>}
                    {debugInfo && (
                        <div className="debug-info" style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(255, 138, 61, 0.1)',
                            border: '1px solid rgba(255, 138, 61, 0.3)',
                            color: '#ffb076',
                            fontSize: '12px',
                            marginBottom: '16px',
                            fontFamily: 'monospace'
                        }}>
                            {debugInfo}
                        </div>
                    )}

                    {/* Tombol Management */}
                    <button className="btn-management" onClick={handleManagementClick}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Kelola Data & Upload File</span>
                    </button>

                    {/* History Section */}
                    <div className="history-section">
                        <h4 className="history-title">Riwayat Data Tersimpan</h4>
                        {history.length === 0 ? (
                            <div className="history-empty">Belum ada riwayat data tersimpan.</div>
                        ) : (
                            <div className="history-list">
                                {history.map((item) => {
                                    const isCurrent = activeHistoryId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`history-item ${isCurrent ? 'active' : ''} clickable`}
                                            onClick={() => handleHistoryItemClick(item)}
                                        >
                                            <div className="history-item-info">
                                                <div className="history-item-name">
                                                    <span>{item.fileName}</span>
                                                    {isCurrent && <span className="badge-active">Aktif</span>}
                                                </div>
                                                <div className="history-item-date">{formatTime(item.uploadedAt)}</div>
                                            </div>
                                            <div className="history-item-arrow">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="9 18 15 12 9 6" />
                                                </svg>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {renderContent()}
            </div>
        </div>
    );
};