import { createClient } from '@supabase/supabase-js';
import type { DashboardData } from './types';
import type { HistoryItem } from './historyDb';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'awakening_upload_history';
const STORAGE_BUCKET = 'dashboarddata';

// ─── localStorage helpers ──────────────────────────────────────────────────

function getLocalHistory(): HistoryItem[] {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(history: HistoryItem[]): void {
  try {
    // Save only slim metadata (no full data) to stay under localStorage quota
    const slim = history.map(({ data: _data, ...rest }) => ({ ...rest, data: null as any }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(slim.slice(0, 15)));
  } catch (e) {
    console.warn('Gagal menyimpan riwayat ke localStorage:', e);
  }
}

// ─── Supabase Storage helpers ──────────────────────────────────────────────

/**
 * Upload DashboardData JSON to Supabase Storage and return its public URL.
 * Falls back to null if upload fails.
 */
async function uploadDataToStorage(id: string, data: DashboardData): Promise<string | null> {
  if (!supabase) return null;
  try {
    const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const filePath = `history/${id}.json`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, jsonBlob, { upsert: true, contentType: 'application/json' });
    if (error) {
      console.warn('[Storage] Upload error:', error.message);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('[Storage] Upload exception:', err);
    return null;
  }
}

/**
 * Fetch DashboardData from a public Supabase Storage URL.
 */
async function fetchDataFromStorage(dataUrl: string): Promise<DashboardData | null> {
  try {
    const res = await fetch(dataUrl + '?t=' + Date.now()); // cache-bust
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function getUploadHistory(): Promise<HistoryItem[]> {
  const localItems = getLocalHistory();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('upload_history')
        .select('id, file_name, uploaded_at, is_active, data_url')
        .order('uploaded_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const dbItems: HistoryItem[] = data.map((row: any) => ({
          id: String(row.id),
          fileName: row.file_name || 'file.xlsx',
          uploadedAt: row.uploaded_at || new Date().toISOString(),
          isActive: Boolean(row.is_active ?? false),
          data: null as any,            // loaded on-demand when user clicks
          _dataUrl: row.data_url,       // store URL for lazy loading
        }));

        // Merge: DB items take priority; add local-only items that aren't in DB yet
        const itemMap = new Map<string, HistoryItem>();
        dbItems.forEach((item) => itemMap.set(item.id, item));
        localItems.forEach((item) => {
          if (!itemMap.has(item.id)) {
            itemMap.set(item.id, item);
          }
        });

        const merged = Array.from(itemMap.values()).sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        saveLocalHistory(merged);
        return merged;
      }
    } catch (err) {
      console.warn('[Supabase] getUploadHistory failed, using localStorage:', err);
    }
  }

  return localItems;
}

/**
 * Load the full DashboardData for a history item.
 * Fetches from Supabase Storage URL stored in the item.
 */
export async function loadHistoryItemData(item: HistoryItem): Promise<DashboardData | null> {
  // Already cached in memory
  if (item.data) return item.data;

  const dataUrl = (item as any)._dataUrl as string | undefined;
  if (dataUrl) {
    const data = await fetchDataFromStorage(dataUrl);
    if (data) return data;
  }

  return null;
}

export async function saveUploadToHistory(file: File, data: DashboardData): Promise<HistoryItem> {
  const id = 'upload_' + Date.now();
  const newItem: HistoryItem = {
    id,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
    data,
    isActive: true,
  };

  // 1. Update local metadata (no full data to stay under quota)
  const localHistory = getLocalHistory();
  localHistory.forEach((item) => (item.isActive = false));
  localHistory.unshift({ ...newItem, data: null as any });
  saveLocalHistory(localHistory);

  if (!supabase) {
    console.warn('[Supabase] Client tidak tersedia, data hanya tersimpan lokal.');
    throw new Error('Database cloud tidak tersedia. Data hanya tersimpan di browser ini.');
  }

  // 2. Upload data JSON to Supabase Storage
  const dataUrl = await uploadDataToStorage(id, data);
  if (!dataUrl) {
    throw new Error('Gagal mengunggah data ke Supabase Storage. Periksa bucket "dashboarddata" dan izin public.');
  }

  // 3. Insert metadata row into DB (data_url points to Storage)
  const { error: insertError } = await supabase
    .from('upload_history')
    .insert({
      id: newItem.id,
      file_name: newItem.fileName,
      uploaded_at: newItem.uploadedAt,
      is_active: true,
      data_url: dataUrl,
    });

  if (insertError) {
    throw new Error(`Gagal menyimpan metadata ke database: ${insertError.message}`);
  }

  // 4. Mark all others as inactive
  await supabase
    .from('upload_history')
    .update({ is_active: false })
    .neq('id', id)
    .then(({ error }) => {
      if (error) console.warn('[Supabase] update is_active warning:', error.message);
    });

  console.log('[Supabase] ✓ Upload selesai:', id, '→', dataUrl);
  return newItem;
}

export async function deleteHistoryItem(id: string): Promise<HistoryItem[]> {
  const localHistory = getLocalHistory().filter((item) => item.id !== id);
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      await supabase.from('upload_history').delete().eq('id', id);
      // Also remove from Storage
      await supabase.storage.from(STORAGE_BUCKET).remove([`history/${id}.json`]);
    } catch (err) {
      console.warn('[Supabase] delete exception:', err);
    }
  }

  return localHistory;
}

export async function setActiveHistoryId(id: string): Promise<void> {
  const localHistory = getLocalHistory();
  localHistory.forEach((item) => (item.isActive = item.id === id));
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      await supabase.from('upload_history').update({ is_active: false }).neq('id', id);
      await supabase.from('upload_history').update({ is_active: true }).eq('id', id);
    } catch (err) {
      console.warn('[Supabase] setActiveHistoryId exception:', err);
    }
  }
}