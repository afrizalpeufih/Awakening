import { createClient } from '@supabase/supabase-js';
import type { DashboardData } from './types';
import type { HistoryItem } from './historyDb';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'awakening_upload_history';
const STORAGE_BUCKET = 'excel-files';

// ─── URL helpers ─────────────────────────────────────────────────────────────

/**
 * Construct the Storage public URL for a given upload ID.
 * No 'data_url' column needed in DB — URL is always predictable from id.
 */
function getStorageUrl(id: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/history/${id}.json`;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

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
 * Upload DashboardData JSON to Supabase Storage bucket.
 * Path: history/{id}.json
 */
async function uploadDataToStorage(id: string, data: DashboardData): Promise<boolean> {
  if (!supabase) return false;
  try {
    const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const filePath = `history/${id}.json`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, jsonBlob, { upsert: true, contentType: 'application/json' });
    if (error) {
      console.warn('[Storage] Upload error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Storage] Upload exception:', err);
    return false;
  }
}

/**
 * Fetch DashboardData JSON from Supabase Storage by id.
 */
async function fetchDataFromStorage(id: string): Promise<DashboardData | null> {
  try {
    const url = getStorageUrl(id) + '?t=' + Date.now(); // cache-bust
    const res = await fetch(url);
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
      // Only select columns that actually exist in the table
      const { data, error } = await supabase
        .from('upload_history')
        .select('id, file_name, uploaded_at, is_active')
        .order('uploaded_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const dbItems: HistoryItem[] = data.map((row: any) => ({
          id: String(row.id),
          fileName: row.file_name || 'file.xlsx',
          uploadedAt: row.uploaded_at || new Date().toISOString(),
          isActive: Boolean(row.is_active ?? false),
          data: null as any, // loaded on-demand
        }));

        // Merge: DB items take priority; add local-only items not yet in DB
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
 * Constructs Storage URL from item id — no 'data_url' column needed.
 */
export async function loadHistoryItemData(item: HistoryItem): Promise<DashboardData | null> {
  // Already cached in memory
  if (item.data) return item.data;

  // Fetch from Supabase Storage using predictable URL from id
  const data = await fetchDataFromStorage(item.id);
  return data;
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

  // 1. Save slim metadata to localStorage as backup
  const localHistory = getLocalHistory();
  localHistory.forEach((item) => (item.isActive = false));
  localHistory.unshift({ ...newItem, data: null as any });
  saveLocalHistory(localHistory);

  if (!supabase) {
    console.warn('[Supabase] Client tidak tersedia.');
    throw new Error('Database cloud tidak tersedia. Data hanya tersimpan di browser ini.');
  }

  // 2. Upload JSON data to Supabase Storage
  const uploaded = await uploadDataToStorage(id, data);
  if (!uploaded) {
    throw new Error(
      `Gagal mengunggah data ke Storage. Pastikan bucket "${STORAGE_BUCKET}" memiliki policy INSERT untuk public.`
    );
  }

  // 3. Insert ONLY metadata into DB (no data_url column needed)
  const insertPayload: any = {
    id: newItem.id,
    file_name: newItem.fileName,
    uploaded_at: newItem.uploadedAt,
  };

  // Try with is_active column — gracefully ignore if column doesn't exist
  try {
    const { error: insertError } = await supabase
      .from('upload_history')
      .insert({ ...insertPayload, is_active: true });

    if (insertError) {
      // If is_active column doesn't exist, retry without it
      if (insertError.message.includes('is_active')) {
        const { error: retryError } = await supabase
          .from('upload_history')
          .insert(insertPayload);
        if (retryError) throw retryError;
      } else {
        throw insertError;
      }
    }
  } catch (err: any) {
    throw new Error(`Gagal menyimpan metadata ke database: ${err.message}`);
  }

  // 4. Mark all others as inactive (best-effort)
  supabase
    .from('upload_history')
    .update({ is_active: false })
    .neq('id', id)
    .then(({ error }) => {
      if (error) console.warn('[Supabase] update is_active warning:', error.message);
    });

  console.log('[Supabase] ✓ Upload selesai:', id, '→', getStorageUrl(id));
  return newItem;
}

export async function deleteHistoryItem(id: string): Promise<HistoryItem[]> {
  const localHistory = getLocalHistory().filter((item) => item.id !== id);
  saveLocalHistory(localHistory);

  if (supabase) {
    try {
      await supabase.from('upload_history').delete().eq('id', id);
      // Also remove JSON from Storage
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